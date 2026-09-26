"""Load only manifest-approved raw snapshots into DuckDB."""
from __future__ import annotations

from pathlib import Path

import duckdb

from .config import DUCKDB_PATH
from .state import latest_completed_paths

DATASETS = {
    "dld_transactions-open-api": {"table": "raw_transactions", "primary_key": ("transaction_id",)},
    "dld_rent_contracts-open-api": {"table": "raw_rent_contracts", "primary_key": ("contract_id",)},
    "dld_projects-open-api": {"table": "raw_projects", "primary_key": ("project_id",)},
    "dld_oa_service_charges-open-api": {
        "table": "raw_service_charges",
        "primary_key": ("property_group_id", "budget_year", "usage_id", "service_category_id"),
    },
}


def load_dataset(dataset: str, db_path: Path = DUCKDB_PATH, raw_paths: list[Path] | None = None) -> dict:
    spec = _dataset_spec(dataset)
    source_paths = latest_completed_paths(dataset) if raw_paths is None else raw_paths
    if not source_paths:
        raise RuntimeError(f"No complete raw snapshots found for {dataset}")
    return _load_paths(spec, source_paths, db_path)


def _dataset_spec(dataset: str) -> dict:
    if dataset not in DATASETS:
        raise ValueError(f"Dataset not wired for load: {dataset}. Known: {list(DATASETS)}")
    return DATASETS[dataset]


def _load_paths(spec: dict, source_paths: list[Path], db_path: Path) -> dict:
    table, primary_key = spec["table"], spec["primary_key"]
    connection = duckdb.connect(str(db_path))
    try:
        _stage_raw_files(connection, source_paths, table)
        raw_count, distinct_count = _staged_counts(connection, table, primary_key)
        _raise_for_empty_or_null_keys(raw_count, connection, table, primary_key)
        _replace_deduplicated_table(connection, table, primary_key)
        final_count = connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
    finally:
        connection.close()
    if final_count != distinct_count:
        raise RuntimeError(f"{table}: deduplication did not produce one row per primary key")
    return _load_summary(table, source_paths, raw_count, final_count)


def _stage_raw_files(connection: duckdb.DuckDBPyConnection, source_paths: list[Path], table: str) -> None:
    connection.execute(
        f"CREATE OR REPLACE TEMP TABLE {table}_staged AS "
        "SELECT *, regexp_extract(filename, '/([^/]+)/[^/]+$', 1) AS _snapshot_id "
        "FROM read_json_auto(?, filename=true, union_by_name=true)",
        [[str(path) for path in source_paths]],
    )


def _staged_counts(connection: duckdb.DuckDBPyConnection, table: str, primary_key: tuple[str, ...]) -> tuple[int, int]:
    primary_key_sql = ", ".join(primary_key)
    raw_count = connection.execute(f"SELECT count(*) FROM {table}_staged").fetchone()[0]
    distinct_count = connection.execute(
        f"SELECT count(*) FROM (SELECT DISTINCT {primary_key_sql} FROM {table}_staged)"
    ).fetchone()[0]
    return raw_count, distinct_count


def _raise_for_empty_or_null_keys(raw_count: int, connection: duckdb.DuckDBPyConnection, table: str, primary_key: tuple[str, ...]) -> None:
    if raw_count == 0:
        raise RuntimeError(f"No rows found in complete snapshots for {table}")
    null_condition = " OR ".join(f"{column} IS NULL" for column in primary_key)
    null_count = connection.execute(f"SELECT count(*) FROM {table}_staged WHERE {null_condition}").fetchone()[0]
    if null_count:
        raise RuntimeError(f"{table}: {null_count} staged rows have a NULL primary key")


def _replace_deduplicated_table(connection: duckdb.DuckDBPyConnection, table: str, primary_key: tuple[str, ...]) -> None:
    primary_key_sql = ", ".join(primary_key)
    connection.execute("BEGIN TRANSACTION")
    try:
        connection.execute(
            f"CREATE OR REPLACE TABLE {table} AS "
            "SELECT * EXCLUDE (_snapshot_id, _rank) FROM ("
            f"SELECT *, row_number() OVER (PARTITION BY {primary_key_sql} "
            "ORDER BY _snapshot_id DESC, filename DESC) AS _rank "
            f"FROM {table}_staged) WHERE _rank = 1"
        )
        connection.execute("COMMIT")
    except duckdb.Error:
        connection.execute("ROLLBACK")
        raise


def _load_summary(table: str, source_paths: list[Path], raw_count: int, final_count: int) -> dict:
    return {
        "table": table,
        "source_file_count": len(source_paths),
        "raw_rows_staged": raw_count,
        "duplicate_rows_collapsed": raw_count - final_count,
        "final_row_count": final_count,
    }
