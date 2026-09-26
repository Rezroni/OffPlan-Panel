"""Build stable market metrics and a JSON export for downstream consumers."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import duckdb

from .config import DUCKDB_PATH, OUT_DIR, ROOT, write_text_atomically

METRIC_VIEWS = ("market_transaction_daily", "market_rent_daily", "project_service_charges")


def build_metrics(db_path: Path = DUCKDB_PATH, out_dir: Path = OUT_DIR) -> dict:
    connection = duckdb.connect(str(db_path))
    try:
        connection.execute((ROOT / "metrics.sql").read_text(encoding="utf-8"))
        metrics = {view_name: _view_rows(connection, view_name) for view_name in METRIC_VIEWS}
    finally:
        connection.close()
    payload = {"generated_at": datetime.now(timezone.utc).isoformat(), "metrics": metrics}
    output_path = out_dir / "market_metrics.json"
    write_text_atomically(output_path, json.dumps(payload, default=str, indent=2))
    return {"output_path": str(output_path), "views": {name: len(rows) for name, rows in metrics.items()}}


def _view_rows(connection: duckdb.DuckDBPyConnection, view_name: str) -> list[dict]:
    cursor = connection.execute(f"SELECT * FROM {view_name} ORDER BY 1, 2")
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]
