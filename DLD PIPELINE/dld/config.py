"""Env loading and path constants shared across the pipeline."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
OUT_DIR = DATA_DIR / "out"
DUCKDB_PATH = DATA_DIR / "dld.duckdb"
STATE_DIR = ROOT / "state"
FETCH_LOG_PATH = STATE_DIR / "fetch_log.jsonl"
TOKEN_CACHE_PATH = STATE_DIR / "token_cache.json"
CONFIG_DIR = ROOT / "config"


def _parse_env_file(path: Path) -> dict[str, str]:
    entries: dict[str, str] = {}
    if not path.exists():
        return entries
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        entries[key.strip()] = value
    return entries


def load_env() -> dict[str, str]:
    """.env values, overridden by any already-set process env vars."""
    env = _parse_env_file(ROOT / ".env")
    env.update({k: v for k, v in os.environ.items() if k.startswith("DATA_DUBAI_")})
    return env


def require(env: dict[str, str], key: str) -> str:
    value = env.get(key)
    if not value:
        raise RuntimeError(f"Missing required env var: {key}")
    return value


def request_timeout_seconds(env: dict[str, str]) -> float:
    raw_timeout = env.get("DATA_DUBAI_REQUEST_TIMEOUT_MS", "30000")
    try:
        timeout_seconds = int(raw_timeout) / 1000
    except ValueError as error:
        raise RuntimeError("DATA_DUBAI_REQUEST_TIMEOUT_MS must be an integer") from error
    if timeout_seconds <= 0:
        raise RuntimeError("DATA_DUBAI_REQUEST_TIMEOUT_MS must be positive")
    return timeout_seconds


def write_text_atomically(path: Path, content: str, mode: int | None = None) -> None:
    write_bytes_atomically(path, content.encode("utf-8"), mode)


def write_bytes_atomically(path: Path, content: bytes, mode: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_path = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(descriptor, "wb") as temporary_file:
            temporary_file.write(content)
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        if mode is not None:
            os.chmod(temporary_path, mode)
        os.replace(temporary_path, path)
    except OSError:
        try:
            os.unlink(temporary_path)
        except FileNotFoundError:
            pass
        raise
