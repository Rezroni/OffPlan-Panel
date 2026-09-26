"""Data-quality validation with explicit valid and rejected tables."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import duckdb

from .config import DUCKDB_PATH, STATE_DIR, write_text_atomically
from .load import DATASETS as LOAD_DATASETS

SUSPICIOUS_REJECTION_RATE = 0.05
RULES = {
    "dld_transactions-open-api": [
        ("missing_or_non_positive_price_or_area", "actual_worth IS NULL OR actual_worth <= 0 OR procedure_area IS NULL OR procedure_area <= 0"),
        ("missing_or_future_instance_date", "instance_date IS NULL OR instance_date > current_date"),
    ],
    "dld_rent_contracts-open-api": [
        ("missing_or_non_positive_annual_amount", "annual_amount IS NULL OR annual_amount <= 0"),
        ("missing_or_future_contract_start_date", "contract_start_date IS NULL OR contract_start_date > current_date"),
    ],
    "dld_oa_service_charges-open-api": [("missing_or_negative_service_cost", "service_cost IS NULL OR service_cost < 0")],
}


def validate_dataset(dataset: str, db_path: Path = DUCKDB_PATH, report_path: Path | None = None) -> dict:
    if dataset not in RULES:
        raise ValueError(f"No validation rules wired for: {dataset}. Known: {list(RULES)}")
    source_table = LOAD_DATASETS[dataset]["table"]
    rules = RULES[dataset]
    connection = duckdb.connect(str(db_path))
    try:
        report = _validate_tables(connection, dataset, source_table, rules)
    finally:
        connection.close()
    destination = report_path or STATE_DIR / f"validation_report_{source_table}.json"
    write_text_atomically(destination, json.dumps(report, indent=2))
    report["report_path"] = str(destination)
    return report


def _validate_tables(connection: duckdb.DuckDBPyConnection, dataset: str, source_table: str, rules: list[tuple[str, str]]) -> dict:
    bad_condition = " OR ".join(f"({condition})" for _, condition in rules)
    rule_counts = _rule_counts(connection, source_table, rules)
    total_rows = connection.execute(f"SELECT count(*) FROM {source_table}").fetchone()[0]
    rejected_rows = connection.execute(f"SELECT count(*) FROM {source_table} WHERE {bad_condition}").fetchone()[0]
    _replace_validation_tables(connection, source_table, bad_condition)
    _verify_reconciliation(connection, source_table, total_rows, rejected_rows)
    return _validation_report(dataset, source_table, total_rows, rejected_rows, rule_counts)


def _rule_counts(connection: duckdb.DuckDBPyConnection, source_table: str, rules: list[tuple[str, str]]) -> dict[str, int]:
    return {
        name: connection.execute(f"SELECT count(*) FROM {source_table} WHERE {condition}").fetchone()[0]
        for name, condition in rules
    }


def _replace_validation_tables(connection: duckdb.DuckDBPyConnection, source_table: str, bad_condition: str) -> None:
    connection.execute("BEGIN TRANSACTION")
    try:
        connection.execute(f"CREATE OR REPLACE TABLE {source_table}_rejected AS SELECT * FROM {source_table} WHERE {bad_condition}")
        connection.execute(f"CREATE OR REPLACE TABLE {source_table}_valid AS SELECT * FROM {source_table} WHERE NOT ({bad_condition})")
        connection.execute("COMMIT")
    except duckdb.Error:
        connection.execute("ROLLBACK")
        raise


def _verify_reconciliation(connection: duckdb.DuckDBPyConnection, source_table: str, total_rows: int, rejected_rows: int) -> None:
    valid_rows = connection.execute(f"SELECT count(*) FROM {source_table}_valid").fetchone()[0]
    if valid_rows + rejected_rows != total_rows:
        raise RuntimeError(f"{source_table}: validation does not reconcile source, valid, and rejected rows")


def _validation_report(dataset: str, source_table: str, total_rows: int, rejected_rows: int, rule_counts: dict[str, int]) -> dict:
    rejection_rate = rejected_rows / total_rows if total_rows else 0.0
    return {
        "dataset": dataset,
        "source_table": source_table,
        "valid_table": f"{source_table}_valid",
        "rejected_table": f"{source_table}_rejected",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_rows": total_rows,
        "rejected_rows": rejected_rows,
        "rejection_rate": round(rejection_rate, 4),
        "suspicious": rejection_rate > SUSPICIOUS_REJECTION_RATE,
        "rule_violation_counts": rule_counts,
    }
