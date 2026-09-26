"""Reliable, manifest-backed retrieval from the Data Dubai open-data API."""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin

import fcntl
import requests

from .auth import get_access_token, security_application_identifier
from .config import RAW_DIR, STATE_DIR, load_env, request_timeout_seconds, write_bytes_atomically
from .state import FetchManifest, append_manifest, completed_fingerprint_set, read_manifests, snapshot_id

MIN_REQUEST_INTERVAL_S = 1.1
PAGE_SIZE = 1000
MAX_PAGES_PER_BUCKET = 1000
REOPEN_WINDOW_DAYS = 3
DEFAULT_ENTITY = "dld"

DATASETS = {
    "dld_transactions-open-api": {"area_field": "area_name_en", "date_field": "instance_date"},
    "dld_rent_contracts-open-api": {"area_field": "area_name_en", "date_field": "contract_start_date"},
}
DIMENSION_DATASETS = {"dld_projects-open-api": {"area_field": "area_name_en"}}
SERVICE_CHARGES_DATASET = "dld_oa_service_charges-open-api"


@dataclass(frozen=True)
class ApiRequest:
    dataset: str
    filter_expression: str


@dataclass(frozen=True)
class ApiPage:
    records: list[dict]
    access_token: str
    page_count: int = 1
    complete: bool = True

    @property
    def is_truncated(self) -> bool:
        return not self.complete


@dataclass(frozen=True)
class SnapshotTarget:
    dataset: str
    area: str
    bucket: str
    snapshot: str
    filename: str
    fingerprint: str


@dataclass(frozen=True)
class AreaFetchRequest:
    area: str | None
    months: int
    dataset: str
    reopen_window_days: int
    label: str


@dataclass
class DayFetchRun:
    gateway: Gateway
    token: str
    area: str | None
    dataset: str
    label: str
    snapshot: str
    complete_buckets: set[str]
    summary: dict


@dataclass
class ServiceChargeRun:
    gateway: Gateway
    token: str
    area: str
    snapshot: str
    complete_fingerprints: set[str]
    summary: dict


@dataclass
class Gateway:
    base_url: str
    security_identifier: str
    timeout_seconds: float
    session: requests.Session
    last_request_at: float = 0.0
    rate_limit_path: Path | None = None

    def fetch_page(self, request: ApiRequest, access_token: str, page_number: int = 1) -> ApiPage:
        if page_number < 1:
            raise ValueError("page_number must be positive")
        refreshed_token = False
        for attempt in range(1, 4):
            try:
                response = self._get(request, access_token, page_number)
            except requests.RequestException:
                if attempt < 3:
                    time.sleep(2**attempt)
                    continue
                raise
            if response.status_code == 401 and not refreshed_token:
                access_token = get_access_token(force_refresh=True)
                refreshed_token = True
                continue
            if response.status_code == 429 or response.status_code >= 500:
                if attempt < 3:
                    time.sleep(2**attempt)
                    continue
            response.raise_for_status()
            try:
                records = _response_records(response, request.dataset)
            except requests.JSONDecodeError:
                # The gateway occasionally returns an HTML error page with a 200
                # response.  It is transient, but must never be persisted as an
                # empty successful snapshot.
                if attempt < 3:
                    time.sleep(2**attempt)
                    continue
                raise RuntimeError(f"{request.dataset} returned non-JSON content after retries") from None
            return ApiPage(records, access_token)
        raise RuntimeError(f"Exhausted retries for {request.dataset}")

    def fetch_all_pages(self, request: ApiRequest, access_token: str) -> ApiPage:
        records: list[dict] = []
        for page_number in range(1, MAX_PAGES_PER_BUCKET + 1):
            page = self.fetch_page(request, access_token, page_number)
            access_token = page.access_token
            records.extend(page.records)
            if len(page.records) < PAGE_SIZE:
                return ApiPage(records, access_token, page_number, complete=True)
        return ApiPage(records, access_token, MAX_PAGES_PER_BUCKET, complete=False)

    def _get(self, request: ApiRequest, access_token: str, page_number: int = 1) -> requests.Response:
        self._wait_for_rate_limit()
        params = {"page": page_number, "pageSize": PAGE_SIZE}
        if request.filter_expression:
            params["filter"] = request.filter_expression
        return self.session.get(
            urljoin(self.base_url, f"open/{DEFAULT_ENTITY}/{request.dataset}"),
            params=params,
            headers={
                "x-DDA-SecurityApplicationIdentifier": self.security_identifier,
                "Authorization": f"Bearer {access_token}",
            },
            timeout=self.timeout_seconds,
        )

    def _wait_for_rate_limit(self) -> None:
        if self.rate_limit_path is not None:
            self._wait_for_shared_rate_limit()
            return
        elapsed = time.monotonic() - self.last_request_at
        if elapsed < MIN_REQUEST_INTERVAL_S:
            time.sleep(MIN_REQUEST_INTERVAL_S - elapsed)
        self.last_request_at = time.monotonic()

    def _wait_for_shared_rate_limit(self) -> None:
        self.rate_limit_path.parent.mkdir(parents=True, exist_ok=True)
        with self.rate_limit_path.open("a+", encoding="utf-8") as lock_file:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            lock_file.seek(0)
            try:
                next_allowed = float(lock_file.read().strip() or "0")
            except ValueError:
                next_allowed = 0.0
            delay = next_allowed - time.time()
            if delay > 0:
                time.sleep(delay)
            lock_file.seek(0)
            lock_file.truncate()
            lock_file.write(str(time.time() + MIN_REQUEST_INTERVAL_S))
            lock_file.flush()
            os.fsync(lock_file.fileno())
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _response_records(response: requests.Response, dataset: str) -> list[dict]:
    body = response.json()
    if not isinstance(body, dict) or not isinstance(body.get("results"), list):
        raise RuntimeError(f"{dataset} response is missing a results list")
    if not all(isinstance(record, dict) for record in body["results"]):
        raise RuntimeError(f"{dataset} response contains a non-object record")
    return body["results"]


def _gateway() -> Gateway:
    env = load_env()
    return Gateway(
        base_url=env.get("DATA_DUBAI_API_BASE_URL", "https://apis.data.dubai/"),
        security_identifier=security_application_identifier(),
        timeout_seconds=request_timeout_seconds(env),
        session=requests.Session(),
        rate_limit_path=STATE_DIR / "dld-api-rate-limit.lock",
    )


def _escape_filter_literal(value: str) -> str:
    return value.replace("'", "''")


def _slugify(value: str) -> str:
    return "".join(character if character.isalnum() else "-" for character in value.strip().lower()).strip("-")


def _day_filter(area_field: str, area: str | None, date_field: str, day: date) -> str:
    date_filter = f"{date_field} like '{day.isoformat()}'"
    if area is None:
        return date_filter
    return f"{area_field} like '{_escape_filter_literal(area)}' and {date_filter}"


def _month_start(today: date, months: int) -> date:
    if months < 0:
        raise ValueError("months must be non-negative")
    month_index = today.month - 1 - months
    year, month = today.year + month_index // 12, month_index % 12 + 1
    month_lengths = [31, 29 if _is_leap_year(year) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return date(year, month, min(today.day, month_lengths[month - 1]))


def _is_leap_year(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def _raw_path(dataset: str, area: str, snapshot: str, filename: str) -> Path:
    return RAW_DIR / dataset / _slugify(area) / snapshot / filename


def _write_raw(path: Path, records: list[dict]) -> None:
    serialized = json.dumps(records, separators=(",", ":")).encode("utf-8")
    write_bytes_atomically(path, gzip.compress(serialized))


def _manifest(target: SnapshotTarget, page: ApiPage, raw_path: Path) -> FetchManifest:
    return FetchManifest(
        dataset=target.dataset,
        area=target.area,
        bucket=target.bucket,
        snapshot_id=target.snapshot,
        row_count=len(page.records),
        status="truncated" if page.is_truncated else "complete",
        raw_path=str(raw_path.relative_to(RAW_DIR.parent.parent)),
        fingerprint=target.fingerprint,
        recorded_at=datetime.now(timezone.utc).isoformat(),
    )


def _record_page(gateway: Gateway, request: ApiRequest, access_token: str, target: SnapshotTarget) -> ApiPage:
    page = gateway.fetch_all_pages(request, access_token)
    raw_path = _raw_path(target.dataset, target.area, target.snapshot, target.filename)
    _write_raw(raw_path, page.records)
    append_manifest(_manifest(target, page, raw_path))
    return page


def fetch_area(request: AreaFetchRequest) -> dict:
    if request.dataset not in DATASETS:
        raise ValueError(f"Dataset not wired for fetch: {request.dataset}. Known: {list(DATASETS)}")
    if request.reopen_window_days < 0:
        raise ValueError("reopen_window_days must be non-negative")
    return _fetch_days(request)


def _fetch_days(request: AreaFetchRequest) -> dict:
    gateway, token = _gateway(), get_access_token()
    today, snapshot = datetime.now(timezone.utc).date(), snapshot_id()
    start = _month_start(today, request.months)
    reopen_from = today - timedelta(days=request.reopen_window_days)
    run = DayFetchRun(gateway, token, request.area, request.dataset, request.label, snapshot, completed_fingerprint_set(request.dataset, request.label), _empty_day_summary(request, start, today))
    day = today
    while day >= start:
        _fetch_one_day(run, day, reopen_from)
        day -= timedelta(days=1)
    return run.summary


def _empty_day_summary(request: AreaFetchRequest, start: date, today: date) -> dict:
    return {"dataset": request.dataset, "area": request.label, "dld_area_name_en": request.area, "window": {"start": start.isoformat(), "end": today.isoformat()}, "fetched_days": 0, "skipped_days": 0, "failed_days": [], "truncated_days": [], "total_records": 0}


def _fetch_one_day(run: DayFetchRun, day: date, reopen_from: date) -> None:
    bucket = day.isoformat()
    if bucket in run.complete_buckets and day < reopen_from:
        run.summary["skipped_days"] += 1
        return
    fields = DATASETS[run.dataset]
    request = ApiRequest(run.dataset, _day_filter(fields["area_field"], run.area, fields["date_field"], day))
    target = SnapshotTarget(run.dataset, run.label, bucket, run.snapshot, f"day_{bucket}.json.gz", bucket)
    try:
        page = _record_page(run.gateway, request, run.token, target)
    except requests.RequestException:
        run.summary["failed_days"].append(bucket)
        return
    run.token = page.access_token
    run.summary["fetched_days"] += 1
    run.summary["total_records"] += len(page.records)
    if page.is_truncated:
        run.summary["truncated_days"].append(bucket)


def latest_dimension_snapshot(dataset: str, area_label: str) -> list[dict]:
    manifests = [manifest for manifest in read_manifests() if manifest.dataset == dataset and manifest.area == area_label and manifest.bucket == "ALL" and manifest.status == "complete"]
    if not manifests:
        raise RuntimeError(f"No complete snapshot for {dataset}/{area_label}; run fetch-projects again")
    raw_path = RAW_DIR.parent.parent / max(manifests, key=lambda manifest: manifest.recorded_at).raw_path
    with gzip.open(raw_path, "rt", encoding="utf-8") as raw_file:
        records = json.load(raw_file)
    if not isinstance(records, list) or not all(isinstance(record, dict) for record in records):
        raise RuntimeError(f"Raw snapshot has an invalid record shape: {raw_path}")
    return records


def fetch_dimension(dataset: str, area: str, label: str | None = None, staleness_days: int = 7) -> dict:
    if dataset not in DIMENSION_DATASETS:
        raise ValueError(f"Dataset not wired as a dimension fetch: {dataset}. Known: {list(DIMENSION_DATASETS)}")
    if staleness_days < 0:
        raise ValueError("staleness_days must be non-negative")
    area_label = label or area
    latest = _latest_complete_dimension(dataset, area_label)
    if latest and _is_fresh(latest, staleness_days):
        return {"dataset": dataset, "area": area_label, "skipped": True, "row_count": latest.row_count}
    gateway, token, snapshot = _gateway(), get_access_token(), snapshot_id()
    field = DIMENSION_DATASETS[dataset]["area_field"]
    target = SnapshotTarget(dataset, area_label, "ALL", snapshot, "all.json.gz", "ALL")
    page = _record_page(gateway, ApiRequest(dataset, f"{field} like '{_escape_filter_literal(area)}'"), token, target)
    if page.is_truncated:
        raise RuntimeError(f"{dataset}/{area_label} hit the {PAGE_SIZE}-row cap; snapshot is quarantined")
    return {"dataset": dataset, "area": area_label, "row_count": len(page.records), "truncated": False}


def fetch_project_catalog(staleness_days: int = 1) -> dict:
    """Fetch the complete current project catalogue, including off-plan statuses."""
    dataset, area_label = "dld_projects-open-api", "All Dubai"
    if staleness_days < 0:
        raise ValueError("staleness_days must be non-negative")
    latest = _latest_complete_dimension(dataset, area_label)
    if latest and _is_fresh(latest, staleness_days):
        return {"dataset": dataset, "area": area_label, "skipped": True, "row_count": latest.row_count}
    page = _record_page(
        _gateway(),
        ApiRequest(dataset, ""),
        get_access_token(),
        SnapshotTarget(dataset, area_label, "ALL", snapshot_id(), "all.json.gz", "ALL"),
    )
    if page.is_truncated:
        raise RuntimeError(f"{dataset}/{area_label} exceeded the {MAX_PAGES_PER_BUCKET}-page safety cap; snapshot is quarantined")
    return {"dataset": dataset, "area": area_label, "row_count": len(page.records), "truncated": False}


def _latest_complete_dimension(dataset: str, area: str) -> FetchManifest | None:
    manifests = [manifest for manifest in read_manifests() if manifest.dataset == dataset and manifest.area == area and manifest.bucket == "ALL" and manifest.status == "complete"]
    return max(manifests, key=lambda manifest: manifest.recorded_at) if manifests else None


def _is_fresh(manifest: FetchManifest, staleness_days: int) -> bool:
    return (datetime.now(timezone.utc) - datetime.fromisoformat(manifest.recorded_at)).days < staleness_days


def fetch_service_charges(area_label: str, project_ids: list[int], budget_years: list[int], chunk_size: int = 20) -> dict:
    if not project_ids:
        raise ValueError("No project IDs available for service-charge fetch")
    if not budget_years:
        raise ValueError("At least one budget year is required")
    if chunk_size < 1:
        raise ValueError("chunk_size must be positive")
    summary = {
        "dataset": SERVICE_CHARGES_DATASET,
        "area": area_label,
        "requested_budget_years": budget_years,
        "fetched_buckets": 0,
        "skipped_buckets": 0,
        "truncated_buckets": [],
        "total_records": 0,
    }
    run = ServiceChargeRun(
        _gateway(),
        get_access_token(),
        area_label,
        snapshot_id(),
        completed_fingerprint_set(SERVICE_CHARGES_DATASET, area_label),
        summary,
    )
    for chunk in _chunks(sorted(set(project_ids)), chunk_size):
        _fetch_service_bucket(run, chunk)
    return summary


def _chunks(values: list[int], chunk_size: int) -> list[list[int]]:
    return [values[index:index + chunk_size] for index in range(0, len(values), chunk_size)]


def _fetch_service_bucket(run: ServiceChargeRun, project_ids: list[int]) -> None:
    fingerprint = _service_fingerprint(project_ids)
    if fingerprint in run.complete_fingerprints:
        run.summary["skipped_buckets"] += 1
        return
    bucket = fingerprint[:12]
    project_filter = ",".join(str(project_id) for project_id in project_ids)
    # The DLD gateway rejects compound filter expressions. Fetching every year
    # for a project group is complete, paginated, and includes the requested
    # eight-year window without relying on a blocked `and budget_year` clause.
    request = ApiRequest(SERVICE_CHARGES_DATASET, f"project_id in ({project_filter})")
    target = SnapshotTarget(SERVICE_CHARGES_DATASET, run.area, bucket, run.snapshot, f"bucket_{bucket}.json.gz", fingerprint)
    page = _record_page(run.gateway, request, run.token, target)
    run.token = page.access_token
    run.summary["fetched_buckets"] += 1
    run.summary["total_records"] += len(page.records)
    if page.is_truncated:
        run.summary["truncated_buckets"].append(bucket)


def _service_fingerprint(project_ids: list[int]) -> str:
    project_key = ",".join(str(project_id) for project_id in project_ids)
    return hashlib.sha256(project_key.encode("utf-8")).hexdigest()
