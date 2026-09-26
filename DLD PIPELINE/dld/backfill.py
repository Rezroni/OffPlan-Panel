"""Resumable citywide DLD history retrieval with paginated API reads."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone

import requests

from .auth import get_access_token
from .fetch import DATASETS, ApiRequest, Gateway, SnapshotTarget, _day_filter, _gateway, _record_page
from .state import completed_fingerprint_set, read_manifests, snapshot_id

CITYWIDE_LABEL = "All Dubai"


@dataclass
class CitywideRun:
    gateway: Gateway
    access_token: str
    dataset: str
    snapshot: str
    complete_periods: set[str]
    truncated_periods: set[str]
    summary: dict


def backfill_history(dataset: str, start_year: int, end_year: int) -> dict:
    """Fetch every citywide year once, resuming from manifest-approved snapshots.

    DLD supports page navigation. The gateway follows every page for a day, so
    a period containing more than 1,000 records is complete rather than silently
    clipped. A citywide date filter also avoids a gateway rule that rejects
    combined area and date filters.
    """
    if dataset not in DATASETS:
        raise ValueError(f"History backfill supports: {sorted(DATASETS)}")
    if start_year > end_year:
        raise ValueError("start_year cannot exceed end_year")
    today = datetime.now(timezone.utc).date()
    start = date(start_year, 1, 1)
    end = min(today, date(end_year, 12, 31))
    if start > end:
        raise ValueError("Requested history begins after the available end date")
    run = CitywideRun(
        _gateway(),
        get_access_token(),
        dataset,
        snapshot_id(),
        completed_fingerprint_set(dataset, CITYWIDE_LABEL),
        _truncated_fingerprint_set(dataset),
        _summary(dataset, start, end),
    )
    for year in range(start.year, end.year + 1):
        _fetch_year(run, year)
    run.summary["generated_at"] = datetime.now(timezone.utc).isoformat()
    return run.summary


def _summary(dataset: str, start: date, end: date) -> dict:
    return {
        "dataset": dataset,
        "area": CITYWIDE_LABEL,
        "window": {"start": start.isoformat(), "end": end.isoformat()},
        "fetched_periods": 0,
        "skipped_periods": 0,
        "failed_periods": [],
        "truncated_periods": [],
        "total_records": 0,
    }


def _fetch_year(run: CitywideRun, year: int) -> None:
    bucket = str(year)
    if _period_complete(run, bucket) or _children_complete(run, _month_tokens(year)):
        run.summary["skipped_periods"] += 1
        return
    if _requires_month_buckets(run, year):
        for month in _month_tokens(year):
            _fetch_month(run, month)
        return
    if _fetch_period(run, bucket):
        for month in _month_tokens(year):
            _fetch_month(run, month)


def _fetch_month(run: CitywideRun, month: str) -> None:
    if _period_complete(run, month):
        run.summary["skipped_periods"] += 1
        return
    if _fetch_period(run, month):
        run.summary["truncated_periods"].append(month)


def _fetch_period(run: CitywideRun, period: str) -> bool | None:
    request = ApiRequest(run.dataset, _period_filter(run.dataset, None, period))
    target = SnapshotTarget(run.dataset, CITYWIDE_LABEL, period, run.snapshot, f"period_{period}.json.gz", _history_fingerprint(period))
    try:
        page = _record_page(run.gateway, request, run.access_token, target)
    except requests.RequestException:
        run.summary["failed_periods"].append(period)
        return None
    run.access_token = page.access_token
    run.summary["fetched_periods"] += 1
    run.summary["total_records"] += len(page.records)
    return page.is_truncated


def _period_complete(run: CitywideRun, period: str) -> bool:
    return _history_fingerprint(period) in run.complete_periods


def _children_complete(run: CitywideRun, periods: list[str]) -> bool:
    return bool(periods) and all(_period_complete(run, period) for period in periods)


def _truncated_fingerprint_set(dataset: str) -> set[str]:
    return {
        manifest.fingerprint
        for manifest in read_manifests()
        if manifest.dataset == dataset and manifest.area == CITYWIDE_LABEL and manifest.status == "truncated"
    }


def _requires_month_buckets(run: CitywideRun, year: int) -> bool:
    for fingerprint in run.truncated_periods:
        period = fingerprint.removeprefix("citywide-prefix-v1:")
        if len(period) == 4 and period.isdigit() and int(period) <= year:
            return True
    return False


def _period_filter(dataset: str, area: str | None, period: str) -> str:
    """Build a DLD prefix filter for a year, month, or exact day."""
    fields = DATASETS[dataset]
    period_date = _period_date(period)
    wildcard = "%" if period.count("-") < 2 else ""
    return _day_filter(fields["area_field"], area, fields["date_field"], period_date).replace(period_date.isoformat(), f"{period}{wildcard}")


def _history_fingerprint(period: str) -> str:
    return f"citywide-prefix-v1:{period}"


def _period_date(period: str) -> date:
    parts = [int(value) for value in period.split("-")]
    if len(parts) == 1:
        return date(parts[0], 1, 1)
    if len(parts) == 2:
        return date(parts[0], parts[1], 1)
    return date(parts[0], parts[1], parts[2])


def _day_tokens(month_token: str) -> list[str]:
    year, month = (int(value) for value in month_token.split("-"))
    next_month = month % 12 + 1
    next_year = year + (month == 12)
    day_count = (date(next_year, next_month, 1) - date(year, month, 1)).days
    return [f"{month_token}-{day:02d}" for day in range(1, day_count + 1)]


def _month_tokens(year: int) -> list[str]:
    return [f"{year}-{month:02d}" for month in range(1, 13)]
