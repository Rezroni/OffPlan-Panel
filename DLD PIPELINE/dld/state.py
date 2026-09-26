"""Durable fetch manifests and the raw files they authorize for loading."""
from __future__ import annotations

import json
import os
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from .config import FETCH_LOG_PATH, RAW_DIR, STATE_DIR


@dataclass(frozen=True)
class FetchManifest:
    dataset: str
    area: str
    bucket: str
    snapshot_id: str
    row_count: int
    status: str
    raw_path: str
    fingerprint: str
    recorded_at: str


def snapshot_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%S%fZ")


def read_manifests(log_path: Path = FETCH_LOG_PATH) -> list[FetchManifest]:
    if not log_path.exists():
        return []
    return [_parse_manifest(line, line_number, log_path) for line_number, line in _nonempty_lines(log_path)]


def _nonempty_lines(log_path: Path) -> Iterable[tuple[int, str]]:
    for line_number, line in enumerate(log_path.read_text(encoding="utf-8").splitlines(), start=1):
        if line.strip():
            yield line_number, line


def _parse_manifest(line: str, line_number: int, log_path: Path) -> FetchManifest:
    try:
        entry = json.loads(line)
        dataset = str(entry["dataset"])
        area = str(entry["area"])
        bucket = str(entry["bucket"] if "bucket" in entry else entry["day"])
        truncated = bool(entry.get("truncated", False))
        status = str(entry.get("status", "truncated" if truncated else "complete"))
        raw_path = str(entry["raw_path"]) if "raw_path" in entry else _legacy_raw_path(entry)
        return FetchManifest(
            dataset=dataset,
            area=area,
            bucket=bucket,
            snapshot_id=str(entry.get("snapshot_id", entry.get("fetch_date", ""))),
            row_count=int(entry["row_count"] if "row_count" in entry else entry["count"]),
            status=status,
            raw_path=raw_path,
            fingerprint=str(entry.get("fingerprint", bucket)),
            recorded_at=str(entry.get("recorded_at", entry.get("ts", ""))),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Invalid fetch manifest at {log_path}:{line_number}") from error


def _legacy_raw_path(entry: dict) -> str:
    dataset = entry["dataset"]
    area = _slugify(str(entry["area"]))
    fetch_date = entry["fetch_date"]
    bucket = str(entry["day"])
    filename = "all.json.gz" if bucket == "ALL" else f"bucket_{bucket}.json.gz" if "_chunk" in bucket else f"day_{bucket}.json.gz"
    return str(Path("data") / "raw" / dataset / area / fetch_date / filename)


def _slugify(value: str) -> str:
    return "".join(character if character.isalnum() else "-" for character in value.strip().lower()).strip("-")


def append_manifest(manifest: FetchManifest, log_path: Path = FETCH_LOG_PATH) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(manifest.__dict__, sort_keys=True)
    with log_path.open("a", encoding="utf-8") as log_file:
        log_file.write(f"{serialized}\n")
        log_file.flush()
        os.fsync(log_file.fileno())


def latest_completed_paths(dataset: str, log_path: Path = FETCH_LOG_PATH, root: Path = RAW_DIR.parent.parent) -> list[Path]:
    latest_by_bucket: dict[tuple[str, str], FetchManifest] = {}
    for manifest in read_manifests(log_path):
        if manifest.dataset != dataset or manifest.status != "complete":
            continue
        key = manifest.area, manifest.bucket
        if key not in latest_by_bucket or manifest.recorded_at > latest_by_bucket[key].recorded_at:
            latest_by_bucket[key] = manifest
    paths = [root / manifest.raw_path for manifest in latest_by_bucket.values()]
    missing_paths = [path for path in paths if not path.exists()]
    if missing_paths:
        missing_list = ", ".join(str(path) for path in missing_paths[:3])
        raise RuntimeError(f"Completed manifests reference missing raw files: {missing_list}")
    return sorted(paths)


def completed_fingerprint_set(dataset: str, area: str, log_path: Path = FETCH_LOG_PATH) -> set[str]:
    return {
        manifest.fingerprint
        for manifest in read_manifests(log_path)
        if manifest.dataset == dataset and manifest.area == area and manifest.status == "complete"
    }
