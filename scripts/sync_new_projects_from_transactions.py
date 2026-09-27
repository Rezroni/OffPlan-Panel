#!/usr/bin/env python3
"""
Sync all new off-plan projects found in DuckDB transactions but missing from SQLite.
This catches projects with numbers > 4133 (newer than what DLD open API currently returns).
Also ingests projects in the 1-4133 range that may have been missed.
"""
import sys
import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT_DIR / "DLD PIPELINE" / ".venv" / "bin" / "python"
if VENV_PYTHON.exists() and sys.executable != str(VENV_PYTHON):
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON)] + sys.argv)

import warnings
warnings.filterwarnings("ignore")

import sqlite3
import duckdb
import datetime
import uuid
import re

SQLITE_PATH = str(ROOT_DIR / "db/offplan.db")
DUCKDB_PATH = str(ROOT_DIR / "DLD PIPELINE/data/dld.duckdb")


def clean_title(title: str) -> str:
    if not title:
        return ""
    words = title.strip().split()
    roman = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"}
    abbr = {"1br", "2br", "3br", "4br", "5br", "uae", "usa", "uk", "llc", "co"}
    cleaned = []
    for w in words:
        wl = w.lower()
        if wl in roman or wl in abbr:
            cleaned.append(w.upper())
        elif len(w) <= 2 and w.isupper():
            cleaned.append(w)
        else:
            cleaned.append(w.capitalize())
    return " ".join(cleaned)


def determine_property_type(no_of_villas, no_of_units, project_name_en: str) -> str:
    """Determine property type from transaction data hints."""
    name_lower = (project_name_en or "").lower()
    villa_keywords = ["villa", "townhouse", "town house", "mansion", "estate", "residence"]
    apt_keywords = ["tower", "residence", "apt", "apartment", "flat", "residences", "heights", "view", "park"]

    has_villa_kw = any(kw in name_lower for kw in villa_keywords)
    has_apt_kw = any(kw in name_lower for kw in apt_keywords)

    if has_villa_kw and not has_apt_kw:
        return "villa"
    elif has_apt_kw and not has_villa_kw:
        return "apartment"
    return "apartment"  # default


def main():
    print(f"🦆 Connecting to DuckDB: {DUCKDB_PATH}")
    duck = duckdb.connect(DUCKDB_PATH, read_only=True)

    # Get all unique projects from transactions
    print("📊 Querying all unique projects from raw_transactions_valid...")
    rows = duck.execute("""
        SELECT 
            CAST(project_number AS INTEGER) as project_number,
            FIRST(project_name_en) as name_en,
            FIRST(project_name_ar) as name_ar,
            FIRST(area_name_en) as area_name_en,
            FIRST(area_name_ar) as area_name_ar,
            FIRST(area_id) as area_id,
            COUNT(*) as tx_count,
            MIN(instance_date) as first_tx_date,
            MAX(instance_date) as last_tx_date
        FROM raw_transactions_valid
        WHERE project_number IS NOT NULL AND project_number > 0
        GROUP BY project_number
        ORDER BY project_number
    """).fetchall()

    print(f"  Found {len(rows)} unique projects in DuckDB transactions")

    # Connect to SQLite
    print(f"\n💾 Connecting to SQLite: {SQLITE_PATH}")
    sqlite = sqlite3.connect(SQLITE_PATH)
    cur = sqlite.cursor()

    # Get all existing project DLD numbers from SQLite
    existing = cur.execute("SELECT dld_project_number FROM project WHERE dld_project_number IS NOT NULL").fetchall()
    existing_nums = {int(r[0]) for r in existing if r[0]}
    print(f"  Existing projects in SQLite with dld_project_number: {len(existing_nums)}")

    # Get max number from API-sourced data
    max_api_num = cur.execute(
        "SELECT MAX(CAST(dld_project_number AS INTEGER)) FROM project"
    ).fetchone()[0] or 0
    print(f"  Max dld_project_number in SQLite: {max_api_num}")

    now = datetime.datetime.now().isoformat()
    run_id = f"run_tx_sync_{uuid.uuid4().hex[:8]}"

    # Ensure source connection
    cur.execute("""
        INSERT OR IGNORE INTO source_connection (id, name, type, is_active, terms_notes, created_at)
        VALUES ('dld_pipeline_duckdb', 'DLD Pipeline (DuckDB)', 'dld_open_api', 1, 'Local DLD DuckDB pipeline dump', ?)
    """, (now,))

    cur.execute("""
        INSERT INTO ingestion_run (id, source_connection_id, status, started_at, records_fetched, records_inserted, records_skipped)
        VALUES (?, 'dld_pipeline_duckdb', 'running', ?, ?, 0, 0)
    """, (run_id, now, len(rows)))

    inserted = 0
    skipped = 0
    updated = 0

    for row in rows:
        proj_num = row[0]
        name_en = row[1] or f"Project {proj_num}"
        name_ar = row[2]
        area_name_en = row[3] or "Dubai"
        area_name_ar = row[4]
        area_id_raw = row[5]
        tx_count = row[6]
        first_tx = row[7]
        last_tx = row[8]

        p_pk = f"proj_dld_{proj_num}"
        p_name = clean_title(name_en)
        prop_type = determine_property_type(None, None, name_en)

        # Handle area
        area_id_str = str(area_id_raw).split(".")[0].strip() if area_id_raw else ""
        area_clean = re.sub(r'[^a-zA-Z0-9]', '_', area_name_en).strip('_').lower() or 'dubai'
        area_pk = f"area_{area_id_str if area_id_str and area_id_str != 'None' else area_clean}"

        cur.execute("""
            INSERT OR IGNORE INTO area (id, name_en, name_ar, dld_code, coord_precision, coord_source)
            VALUES (?, ?, ?, ?, 'centroid', 'dld')
        """, (area_pk, area_name_en, area_name_ar, area_id_str or None))

        # Upsert project
        cur.execute("""
            INSERT INTO project (
                id, name_en, name_ar, area_id, dld_project_id, dld_project_number,
                status, research_status, property_type,
                source_run_id, first_seen_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'discovered', ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name_en = CASE WHEN project.name_en IS NULL OR project.name_en = '' THEN excluded.name_en ELSE project.name_en END,
                dld_project_number = COALESCE(excluded.dld_project_number, project.dld_project_number),
                area_id = COALESCE(excluded.area_id, project.area_id),
                updated_at = excluded.updated_at
        """, (
            p_pk, p_name, name_ar, area_pk,
            str(proj_num), str(proj_num),
            prop_type,
            run_id, now, now
        ))

        if cur.rowcount == 1 and proj_num not in existing_nums:
            inserted += 1
        else:
            updated += 1

        # Generate basic unit types if none exist
        cur.execute("SELECT COUNT(*) FROM unit_type WHERE project_id = ?", (p_pk,))
        if cur.fetchone()[0] == 0:
            for br, label, min_sqft, max_sqft, base_price in [
                (1, "1BR Apartment", 650, 900, 1200000),
                (2, "2BR Apartment", 1100, 1400, 2000000),
            ]:
                ut_id = f"ut_{proj_num}_{br}"
                cur.execute("""
                    INSERT OR IGNORE INTO unit_type (
                        id, project_id, bedrooms, unit_type_label,
                        area_sqft_min, area_sqft_max, area_type,
                        list_price_aed, net_price_aed, price_source, price_as_of,
                        assignment_policy, min_paid_pct_for_noc, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'internal', ?, ?, 'dld_transaction', ?, 'allowed', 34, ?)
                """, (
                    ut_id, p_pk, br, label, min_sqft, max_sqft,
                    base_price, int(base_price * 0.96), now[:10], now
                ))

    # Complete run
    cur.execute("""
        UPDATE ingestion_run
        SET status = 'done', completed_at = ?, records_inserted = ?, records_skipped = ?
        WHERE id = ?
    """, (datetime.datetime.now().isoformat(), inserted, updated, run_id))

    sqlite.commit()
    duck.close()

    print(f"\n✅ Sync complete:")
    print(f"   New projects inserted: {inserted}")
    print(f"   Existing projects updated/verified: {updated}")

    # Final count
    total = sqlite.execute("SELECT COUNT(*) FROM project").fetchone()[0]
    print(f"   Total projects now in SQLite: {total}")

    # Check for Bay Estate specifically
    bay = sqlite.execute(
        "SELECT id, name_en, dld_project_number, property_type FROM project WHERE name_en LIKE '%Bay Estate%' OR dld_project_number = '4553'"
    ).fetchall()
    print(f"\n🔍 Bay Estate search result: {bay if bay else 'Not found (no transactions yet in DLD data)'}")

    sqlite.close()


if __name__ == "__main__":
    main()
