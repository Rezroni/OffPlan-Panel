from __future__ import annotations

import gzip
import json
import tempfile
import unittest
from pathlib import Path

import duckdb

from dld.fetch import ApiRequest, Gateway
from dld.backfill import _day_tokens, _period_filter
from dld.load import load_dataset
from dld.metrics import build_metrics
from dld.state import FetchManifest, append_manifest, latest_completed_paths
from dld.validate import validate_dataset


class FakeResponse:
    def __init__(self, body: object, status_code: int = 200):
        self.body = body
        self.status_code = status_code

    def json(self) -> object:
        return self.body

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeSession:
    def __init__(self, response: FakeResponse):
        self.response = response

    def get(self, *_: object, **__: object) -> FakeResponse:
        return self.response


class FakePagedSession:
    def __init__(self, pages: list[FakeResponse]):
        self.pages = pages
        self.requested_pages: list[int] = []

    def get(self, *_: object, **kwargs: object) -> FakeResponse:
        page_number = kwargs["params"]["page"]  # type: ignore[index]
        self.requested_pages.append(page_number)
        return self.pages[page_number - 1]


class PipelineTests(unittest.TestCase):
    def test_invalid_api_envelope_fails_instead_of_creating_an_empty_snapshot(self) -> None:
        gateway = Gateway("https://example.test/", "security", 1, FakeSession(FakeResponse({"error": "down"})), -100)
        with self.assertRaisesRegex(RuntimeError, "results list"):
            gateway.fetch_page(ApiRequest("transactions", "instance_date like '2026-01-01'"), "token")

    def test_gateway_reads_every_api_page_before_marking_a_bucket_complete(self) -> None:
        first_page = [{"transaction_id": str(index)} for index in range(1000)]
        session = FakePagedSession([FakeResponse({"results": first_page}), FakeResponse({"results": [{"transaction_id": "1000"}]})])
        gateway = Gateway("https://example.test/", "security", 1, session, -100)
        page = gateway.fetch_all_pages(ApiRequest("transactions", "instance_date like '2026-01-01'"), "token")
        self.assertEqual(len(page.records), 1001)
        self.assertTrue(page.complete)
        self.assertEqual(session.requested_pages, [1, 2])

    def test_loader_uses_complete_manifest_and_ignores_truncated_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            complete_path = root / "data/raw/example/area/snapshot/day_2026-01-01.json.gz"
            truncated_path = root / "data/raw/example/area/snapshot/day_2026-01-02.json.gz"
            _write_gzip_json(complete_path, [{"transaction_id": "complete"}])
            _write_gzip_json(truncated_path, [{"transaction_id": "truncated"}])
            log_path = root / "state/fetch_log.jsonl"
            append_manifest(_manifest("complete", "data/raw/example/area/snapshot/day_2026-01-01.json.gz", "complete"), log_path)
            append_manifest(_manifest("truncated", "data/raw/example/area/snapshot/day_2026-01-02.json.gz", "truncated"), log_path)
            paths = latest_completed_paths("example", log_path, root)
            self.assertEqual(paths, [complete_path])

    def test_load_deduplicates_latest_complete_snapshot_in_real_duckdb(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first_path = root / "s1/day.json.gz"
            second_path = root / "s2/day.json.gz"
            _write_gzip_json(first_path, [{"transaction_id": "shared"}, {"transaction_id": "first"}])
            _write_gzip_json(second_path, [{"transaction_id": "shared"}, {"transaction_id": "second"}])
            database_path = root / "warehouse.duckdb"
            summary = load_dataset("dld_transactions-open-api", database_path, [first_path, second_path])
            connection = duckdb.connect(str(database_path), read_only=True)
            try:
                identifiers = connection.execute("SELECT transaction_id FROM raw_transactions ORDER BY 1").fetchall()
            finally:
                connection.close()
            self.assertEqual(summary["final_row_count"], 3)
            self.assertEqual(identifiers, [("first",), ("second",), ("shared",)])

    def test_validation_rejects_null_date_and_reconciles_every_source_row(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database_path = root / "warehouse.duckdb"
            connection = duckdb.connect(str(database_path))
            connection.execute("CREATE TABLE raw_rent_contracts (annual_amount DOUBLE, contract_start_date DATE)")
            connection.execute("INSERT INTO raw_rent_contracts VALUES (100000, '2026-01-01'), (120000, NULL)")
            connection.close()
            report = validate_dataset("dld_rent_contracts-open-api", database_path, root / "report.json")
            self.assertEqual(report["rejected_rows"], 1)
            self.assertEqual(_table_count(database_path, "raw_rent_contracts_valid"), 1)
            self.assertEqual(_table_count(database_path, "raw_rent_contracts_rejected"), 1)

    def test_metrics_export_uses_real_validated_tables(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database_path = root / "warehouse.duckdb"
            connection = duckdb.connect(str(database_path))
            connection.execute("CREATE TABLE raw_transactions_valid (instance_date DATE, area_name_en VARCHAR, actual_worth DOUBLE, procedure_area DOUBLE)")
            connection.execute("INSERT INTO raw_transactions_valid VALUES ('2026-01-01', 'Business Bay', 100, 10)")
            connection.execute("CREATE TABLE raw_rent_contracts_valid (contract_start_date DATE, area_name_en VARCHAR, annual_amount DOUBLE)")
            connection.execute("INSERT INTO raw_rent_contracts_valid VALUES ('2026-01-01', 'Business Bay', 120000)")
            connection.execute("CREATE TABLE raw_service_charges_valid (project_id BIGINT, budget_year BIGINT, service_cost DOUBLE)")
            connection.execute("INSERT INTO raw_service_charges_valid VALUES (1, 2026, 5000)")
            connection.close()
            summary = build_metrics(database_path, root / "out")
            payload = json.loads((root / "out/market_metrics.json").read_text())
            self.assertEqual(summary["views"]["market_transaction_daily"], 1)
            self.assertEqual(payload["metrics"]["market_rent_daily"][0]["median_annual_rent_aed"], 120000.0)

    def test_history_periods_preserve_the_api_filter_grain(self) -> None:
        self.assertEqual(
            _period_filter("dld_transactions-open-api", "Business Bay", "2018-02"),
            "area_name_en like 'Business Bay' and instance_date like '2018-02%'",
        )
        self.assertEqual(_day_tokens("2020-02")[-1], "2020-02-29")


def _manifest(bucket: str, raw_path: str, status: str) -> FetchManifest:
    return FetchManifest("example", "area", bucket, "snapshot", 1, status, raw_path, bucket, f"2026-01-01T00:00:0{len(bucket)}+00:00")


def _write_gzip_json(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as raw_file:
        json.dump(records, raw_file)


def _table_count(database_path: Path, table_name: str) -> int:
    connection = duckdb.connect(str(database_path), read_only=True)
    try:
        return connection.execute(f"SELECT count(*) FROM {table_name}").fetchone()[0]
    finally:
        connection.close()
