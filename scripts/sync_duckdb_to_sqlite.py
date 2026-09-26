#!/usr/bin/env python3
"""
Full DLD DuckDB -> SQLite Fast Synchronizer
Imports all transactions, rent contracts, and service charges from DuckDB into SQLite.
"""
import sys
import os
import time
import datetime
import uuid
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT_DIR / "DLD PIPELINE" / ".venv" / "bin" / "python"
if VENV_PYTHON.exists() and sys.executable != str(VENV_PYTHON):
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON)] + sys.argv)

import duckdb
import sqlite3

DUCKDB_PATH = str(ROOT_DIR / "DLD PIPELINE/data/dld.duckdb")
SQLITE_PATH = str(ROOT_DIR / "db/offplan.db")
SQM_TO_SQFT = 10.7639104

def parse_bedrooms(sub_type_en):
    if not sub_type_en:
        return None
    s = str(sub_type_en).lower()
    if "studio" in s:
        return 0
    if "1" in s or "one" in s:
        return 1
    if "2" in s or "two" in s:
        return 2
    if "3" in s or "three" in s:
        return 3
    if "4" in s or "four" in s:
        return 4
    if "5" in s or "five" in s:
        return 5
    if "6" in s or "six" in s:
        return 6
    return None

def main():
    print(f"🚀 Starting DLD Sync from DuckDB ({DUCKDB_PATH}) -> SQLite ({SQLITE_PATH})")
    duck = duckdb.connect(DUCKDB_PATH, read_only=True)
    sqlite = sqlite3.connect(SQLITE_PATH)
    cur = sqlite.cursor()

    cur.execute("PRAGMA synchronous = OFF")
    cur.execute("PRAGMA journal_mode = WAL")
    cur.execute("PRAGMA cache_size = -64000") # 64MB cache

    now = datetime.datetime.now().isoformat()
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    cur.execute("""
        INSERT OR IGNORE INTO source_connection (id, name, type, is_active, terms_notes, created_at)
        VALUES ('dld_pipeline_duckdb', 'DLD Pipeline (DuckDB)', 'dld_open_api', 1, 'Local DLD DuckDB pipeline sync', ?)
    """, (now,))
    cur.execute("""
        INSERT INTO ingestion_run (id, source_connection_id, status, started_at, records_fetched, records_inserted, records_skipped)
        VALUES (?, 'dld_pipeline_duckdb', 'running', ?, 0, 0, 0)
    """, (run_id, now))
    sqlite.commit()

    # -------------------------------------------------------------
    # 1. Sync Rent Contracts (Ejari)
    # -------------------------------------------------------------
    print("\n📦 1. Syncing Rent Contracts (Ejari)...")
    rent_total_duck = duck.execute("SELECT count(*) FROM raw_rent_contracts_valid").fetchone()[0]
    print(f"  Total valid rent contracts in DuckDB: {rent_total_duck:,}")

    # We import all residential and single-property rent contracts (from 2023+ for optimal web performance)
    rent_cur = duck.execute("""
        SELECT 
            contract_id as id,
            cast(contract_start_date as varchar) as contract_date,
            cast(contract_start_date as varchar) as start_date,
            cast(contract_end_date as varchar) as end_date,
            lower(coalesce(contract_reg_type_en, 'new')) as contract_type,
            coalesce(area_name_en, 'Dubai') as area_name_en,
            project_name_en as building_name_en,
            null as unit_no,
            ejari_property_sub_type_en,
            actual_area as area_sqm,
            actual_area * 10.7639104 as area_sqft,
            cast(coalesce(annual_amount, contract_amount, 0) as bigint) as annual_rent_aed,
            case when no_of_prop > 1 then 1 else 0 end as is_multi_property,
            case when lower(coalesce(property_usage_en, 'residential')) != 'residential' then 1 else 0 end as is_excluded,
            case when lower(coalesce(property_usage_en, 'residential')) != 'residential' then 'non_residential' else null end as exclusion_reason,
            case when project_number is not null then 'proj_dld_' || cast(cast(project_number as bigint) as varchar) else null end as matched_project_id
        FROM raw_rent_contracts_valid
        WHERE contract_start_date >= '2023-01-01'
    """)

    rent_count = 0
    t0 = time.time()
    while True:
        chunk = rent_cur.fetchmany(50000)
        if not chunk:
            break
        batch = []
        for r in chunk:
            bed = parse_bedrooms(r[8])
            batch.append((
                r[0], run_id, r[1], r[2], r[3], r[4], r[5], r[6], r[7],
                bed, r[9], r[10], r[11], r[12], r[13], r[14], r[15], "auto" if r[15] else "unmatched"
            ))
        cur.executemany("""
            INSERT OR REPLACE INTO rent_contract_fact (
                id, source_run_id, contract_date, start_date, end_date, contract_type,
                area_name_en, building_name_en, unit_no, bedrooms, area_sqm, area_sqft,
                annual_rent_aed, is_multi_property, is_excluded, exclusion_reason,
                matched_project_id, match_confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, batch)
        sqlite.commit()
        rent_count += len(batch)
        print(f"  Synced {rent_count:,} rent contracts ({time.time() - t0:.1f}s)...")

    print(f"✅ Rent contracts sync completed: {rent_count:,} records in SQLite.")

    # -------------------------------------------------------------
    # 2. Sync All Valid Transactions
    # -------------------------------------------------------------
    print("\n📦 2. Syncing Transactions...")
    tx_total_duck = duck.execute("SELECT count(*) FROM raw_transactions_valid").fetchone()[0]
    print(f"  Total valid transactions in DuckDB: {tx_total_duck:,}")

    # Build num_to_pid map
    proj_map_rows = sqlite.execute("SELECT dld_project_id, id FROM project WHERE dld_project_id IS NOT NULL").fetchall()
    num_to_pid = {str(r[0]): r[1] for r in proj_map_rows}

    tx_cur = duck.execute("""
        SELECT 
            transaction_id as id,
            cast(instance_date as varchar) as tx_date,
            cast(instance_date as varchar) as reg_date,
            area_name_en,
            building_name_en,
            project_name_en,
            cast(project_number as varchar) as p_num,
            rooms_en,
            rooms_ar,
            procedure_area as area_sqm,
            procedure_area * 10.7639104 as area_sqft,
            cast(actual_worth as bigint) as val_aed,
            procedure_name_en,
            property_type_en,
            property_sub_type_en,
            trans_group_en,
            reg_type_en
        FROM raw_transactions_valid
    """)

    tx_count = 0
    non_sale_types = ["mortgage", "gift", "inheritance", "whole building", "bulk"]
    t0 = time.time()

    while True:
        chunk = tx_cur.fetchmany(50000)
        if not chunk:
            break
        batch = []
        for r in chunk:
            tx_id = str(r[0])
            tx_date = str(r[1] or "")
            reg_date = str(r[2] or "")
            area = r[3]
            building = r[4]
            proj_name = r[5]
            p_num = str(r[6]).split(".")[0] if r[6] else None
            matched_p_pk = num_to_pid.get(p_num) if p_num else None

            # parse bedrooms
            r_en = str(r[7] or "").lower()
            bed = None
            if "studio" in r_en or r_en == "0":
                bed = 0
            elif "1" in r_en:
                bed = 1
            elif "2" in r_en:
                bed = 2
            elif "3" in r_en:
                bed = 3
            elif "4" in r_en:
                bed = 4
            elif "5" in r_en:
                bed = 5

            area_sqm = float(r[9] or 0.0)
            area_sqft = float(r[10] or 0.0)
            val_aed = int(r[11] or 0)
            psf_aed = (val_aed / area_sqft) if (area_sqft > 0 and val_aed > 0) else None

            proc_en = str(r[12] or "").lower()
            prop_type_en = str(r[13] or "").lower()
            prop_sub_en = str(r[14] or "").lower()
            trans_group = str(r[15] or "").lower()
            reg_type = str(r[16] or "").lower()

            is_excluded = 0
            exclusion_reason = None
            for nst in non_sale_types:
                if nst in trans_group or nst in proc_en:
                    is_excluded = 1
                    exclusion_reason = f"non_sale:{nst}"
                    break
            if not is_excluded and ("land" in prop_type_en or "land" in prop_sub_en):
                is_excluded = 1
                exclusion_reason = "land"

            is_off_plan = 1 if ("off-plan" in reg_type or "off plan" in reg_type or "pre registration" in proc_en) else 0
            is_residential = 1 if any(x in prop_sub_en for x in ["flat", "apartment", "studio", "penthouse", "duplex"]) else 0

            batch.append((
                tx_id, run_id, tx_id, tx_date, reg_date, area, building, proj_name, p_num,
                bed, area_sqm, area_sqft, val_aed, psf_aed, r[12], r[13], r[14],
                is_off_plan, is_residential, is_excluded, exclusion_reason,
                matched_p_pk, "auto" if matched_p_pk else "unmatched"
            ))

        cur.executemany("""
            INSERT OR REPLACE INTO transaction_fact (
                id, source_run_id, transaction_no, transaction_date, registration_date,
                area_name_en, building_name_en, project_name_en, dld_project_id,
                bedrooms, area_sqm, area_sqft, transaction_value_aed, price_per_sqft_aed,
                transaction_type, property_type, property_subtype,
                is_off_plan, is_residential, is_excluded, exclusion_reason,
                matched_project_id, match_confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, batch)
        sqlite.commit()
        tx_count += len(batch)
        print(f"  Synced {tx_count:,} transactions ({time.time() - t0:.1f}s)...")

    print(f"✅ Transactions sync completed: {tx_count:,} records in SQLite.")

    # -------------------------------------------------------------
    # 3. Update Health Check Record
    # -------------------------------------------------------------
    cur.execute("""
        UPDATE ingestion_run
        SET status = 'done', completed_at = ?, records_fetched = ?, records_inserted = ?
        WHERE id = ?
    """, (datetime.datetime.now().isoformat(), tx_count + rent_count, tx_count + rent_count, run_id))

    cur.execute("""
        INSERT OR REPLACE INTO data_health_check (
            id, source_connection_id, checked_at, total_records, status, coverage_notes
        ) VALUES (?, 'dld_pipeline_duckdb', ?, ?, 'ok', ?)
    """, (
        f"health_{run_id}",
        datetime.datetime.now().isoformat(),
        tx_count + rent_count,
        f"Synced {tx_count:,} transactions and {rent_count:,} rent contracts from live DuckDB."
    ))
    sqlite.commit()

    print("\n🎉 Full DuckDB -> SQLite synchronization finished successfully!")

if __name__ == "__main__":
    main()
