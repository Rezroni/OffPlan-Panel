"""Command-line interface for fetching, validating, and exporting DLD data."""
from __future__ import annotations

import argparse
import json
import sys

from . import backfill, fetch, load, metrics, validate
from .clusters import resolve_area


def main(argv: list[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    try:
        summary = _run_command(args, parser)
    except (RuntimeError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    print(json.dumps(summary, indent=2))
    return 2 if _is_incomplete(summary) else 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m dld")
    commands = parser.add_subparsers(dest="command", required=True)
    _add_fetch_parser(commands)
    _add_projects_parser(commands)
    _add_all_projects_parser(commands)
    _add_service_charges_parser(commands)
    _add_dataset_parser(commands, "load", "load complete raw JSON into DuckDB", load.DATASETS)
    _add_dataset_parser(commands, "validate", "validate loaded data", validate.RULES)
    _add_history_parser(commands)
    _add_full_sync_parser(commands)
    commands.add_parser("build-metrics", help="create metrics views and JSON export")
    _add_run_parser(commands)
    return parser


def _add_fetch_parser(commands: argparse._SubParsersAction) -> None:
    parser = commands.add_parser("fetch", help="backfill or refresh one dataset")
    _add_area_arguments(parser, citywide=True)
    parser.add_argument("--months", type=int, default=24)
    parser.add_argument("--dataset", default="dld_transactions-open-api", choices=sorted(fetch.DATASETS))
    parser.add_argument("--reopen-days", type=int, default=fetch.REOPEN_WINDOW_DAYS)


def _add_projects_parser(commands: argparse._SubParsersAction) -> None:
    parser = commands.add_parser("fetch-projects", help="fetch an area project dimension")
    _add_area_arguments(parser)
    parser.add_argument("--staleness-days", type=int, default=7)


def _add_all_projects_parser(commands: argparse._SubParsersAction) -> None:
    parser = commands.add_parser("fetch-all-projects", help="fetch the complete current Dubai project catalogue")
    parser.add_argument("--staleness-days", type=int, default=1)


def _add_service_charges_parser(commands: argparse._SubParsersAction) -> None:
    parser = commands.add_parser("fetch-service-charges", help="fetch service charges linked to area projects")
    _add_area_arguments(parser)
    parser.add_argument("--budget-years", default="2017-2024")
    parser.add_argument("--chunk-size", type=int, default=20)


def _add_dataset_parser(commands: argparse._SubParsersAction, name: str, help_text: str, datasets: dict) -> None:
    parser = commands.add_parser(name, help=help_text)
    parser.add_argument("--dataset", default="dld_transactions-open-api", choices=sorted(datasets))


def _add_run_parser(commands: argparse._SubParsersAction) -> None:
    parser = commands.add_parser("run", help="run fetch, load, validate, and metrics for one area")
    _add_area_arguments(parser)
    parser.add_argument("--months", type=int, default=24)
    parser.add_argument("--reopen-days", type=int, default=fetch.REOPEN_WINDOW_DAYS)
    parser.add_argument("--budget-years", default="2017-2024")
    parser.add_argument("--chunk-size", type=int, default=20)


def _add_history_parser(commands: argparse._SubParsersAction) -> None:
    parser = commands.add_parser("backfill-history", help="backfill all discovered Dubai areas with adaptive time buckets")
    parser.add_argument("--dataset", required=True, choices=("dld_transactions-open-api", "dld_rent_contracts-open-api"))
    parser.add_argument("--start-year", type=int, default=2018)
    parser.add_argument("--end-year", type=int, default=2026)


def _add_full_sync_parser(commands: argparse._SubParsersAction) -> None:
    parser = commands.add_parser("sync-full-dubai", help="fetch, load, validate, and export the complete Dubai warehouse")
    parser.add_argument("--start-year", type=int, default=2018)
    parser.add_argument("--end-year", type=int, default=2026)
    parser.add_argument("--budget-years", default="2018-2026")
    parser.add_argument("--service-chunk-size", type=int, default=20)


def _add_area_arguments(parser: argparse.ArgumentParser, citywide: bool = False) -> None:
    area_group = parser.add_mutually_exclusive_group(required=not citywide)
    area_group.add_argument("--area", help="configured cluster display name or DLD area name")
    area_group.add_argument("--raw-area", help="explicit unconfigured DLD area_name_en")
    if citywide:
        area_group.add_argument("--citywide", action="store_true")


def _run_command(args: argparse.Namespace, parser: argparse.ArgumentParser) -> dict:
    if args.command == "fetch":
        area, label = _area_arguments(args, parser)
        return fetch.fetch_area(fetch.AreaFetchRequest(area, args.months, args.dataset, args.reopen_days, label))
    if args.command == "fetch-projects":
        area, label = _area_arguments(args, parser)
        return fetch.fetch_dimension("dld_projects-open-api", area, label, args.staleness_days)
    if args.command == "fetch-all-projects":
        return fetch.fetch_project_catalog(args.staleness_days)
    if args.command == "fetch-service-charges":
        return _fetch_service_charges(args, parser)
    if args.command == "load":
        return load.load_dataset(args.dataset)
    if args.command == "validate":
        return validate.validate_dataset(args.dataset)
    if args.command == "backfill-history":
        return backfill.backfill_history(args.dataset, args.start_year, args.end_year)
    if args.command == "sync-full-dubai":
        return _sync_full_dubai(args)
    if args.command == "build-metrics":
        return metrics.build_metrics()
    if args.command == "run":
        return _run_area_pipeline(args, parser)
    raise RuntimeError(f"Unsupported command: {args.command}")


def _area_arguments(args: argparse.Namespace, parser: argparse.ArgumentParser) -> tuple[str | None, str]:
    if getattr(args, "citywide", False):
        return None, "All Dubai"
    if args.raw_area:
        return args.raw_area, args.raw_area
    if args.area:
        return resolve_area(args.area)
    parser.error("An area is required")
    raise AssertionError("argparse exits")


def _fetch_service_charges(args: argparse.Namespace, parser: argparse.ArgumentParser) -> dict:
    _, label = _area_arguments(args, parser)
    records = fetch.latest_dimension_snapshot("dld_projects-open-api", label)
    project_ids = sorted({record["project_id"] for record in records if record.get("project_id") is not None})
    return fetch.fetch_service_charges(label, project_ids, _budget_years(args.budget_years), args.chunk_size)


def _budget_years(raw_years: str) -> list[int]:
    try:
        start, end = (int(value) for value in raw_years.split("-"))
    except ValueError as error:
        raise ValueError("budget-years must use YYYY-YYYY") from error
    if start > end:
        raise ValueError("budget-years start cannot exceed end")
    return list(range(start, end + 1))


def _run_area_pipeline(args: argparse.Namespace, parser: argparse.ArgumentParser) -> dict:
    area, label = _area_arguments(args, parser)
    fetches = {
        "transactions": fetch.fetch_area(fetch.AreaFetchRequest(area, args.months, "dld_transactions-open-api", args.reopen_days, label)),
        "rent_contracts": fetch.fetch_area(fetch.AreaFetchRequest(area, args.months, "dld_rent_contracts-open-api", args.reopen_days, label)),
        "projects": fetch.fetch_dimension("dld_projects-open-api", area, label),
    }
    records = fetch.latest_dimension_snapshot("dld_projects-open-api", label)
    project_ids = sorted({record["project_id"] for record in records if record.get("project_id") is not None})
    fetches["service_charges"] = fetch.fetch_service_charges(label, project_ids, _budget_years(args.budget_years), args.chunk_size)
    _raise_if_incomplete(fetches)
    loads = {dataset: load.load_dataset(dataset) for dataset in load.DATASETS}
    validations = {dataset: validate.validate_dataset(dataset) for dataset in validate.RULES}
    _raise_if_incomplete(validations)
    return {"fetches": fetches, "loads": loads, "validations": validations, "metrics": metrics.build_metrics()}


def _sync_full_dubai(args: argparse.Namespace) -> dict:
    fetches = {
        "transactions": backfill.backfill_history("dld_transactions-open-api", args.start_year, args.end_year),
        "rent_contracts": backfill.backfill_history("dld_rent_contracts-open-api", args.start_year, args.end_year),
        "projects": fetch.fetch_project_catalog(staleness_days=1),
    }
    records = fetch.latest_dimension_snapshot("dld_projects-open-api", "All Dubai")
    project_ids = sorted({record["project_id"] for record in records if record.get("project_id") is not None})
    fetches["service_charges"] = fetch.fetch_service_charges("All Dubai", project_ids, _budget_years(args.budget_years), args.service_chunk_size)
    _raise_if_incomplete(fetches)
    loads = {dataset: load.load_dataset(dataset) for dataset in load.DATASETS}
    validations = {dataset: validate.validate_dataset(dataset) for dataset in validate.RULES}
    _raise_if_incomplete(validations)
    return {"fetches": fetches, "loads": loads, "validations": validations, "metrics": metrics.build_metrics()}


def _raise_if_incomplete(summaries: dict) -> None:
    if _is_incomplete(summaries):
        raise RuntimeError("Pipeline data is incomplete; raw files were not loaded or exported")


def _is_incomplete(value: object) -> bool:
    if isinstance(value, dict):
        if (
            value.get("suspicious")
            or value.get("failed_days")
            or value.get("truncated_days")
            or value.get("failed_periods")
            or value.get("truncated_periods")
            or value.get("truncated_buckets")
        ):
            return True
        return any(_is_incomplete(child) for child in value.values())
    if isinstance(value, list):
        return any(_is_incomplete(child) for child in value)
    return False


if __name__ == "__main__":
    sys.exit(main())
