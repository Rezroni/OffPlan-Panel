#!/usr/bin/env python3
"""
Direct DuckDB -> SQLite Seeder for Dubai Off-plan Research Desk
Using Python DuckDB + built-in sqlite3.
"""
import sys
import os
from pathlib import Path

# Self-reexec with virtualenv python if needed
ROOT_DIR = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT_DIR / "DLD PIPELINE" / ".venv" / "bin" / "python"
if VENV_PYTHON.exists() and sys.executable != str(VENV_PYTHON):
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON)] + sys.argv)

import warnings
warnings.filterwarnings("ignore")

import duckdb
import sqlite3
import re
import datetime
import uuid
import math
import json

DUCKDB_PATH = str(ROOT_DIR / "DLD PIPELINE/data/dld.duckdb")
SQLITE_PATH = str(ROOT_DIR / "db/offplan.db")
CACHE_PROJECTS = str(ROOT_DIR / "DLD PIPELINE/data/all_dld_projects.json")

SQM_TO_SQFT = 10.7639104

def safe_int_str(val):
    """Safely convert numeric/float/string to integer string without crashing on NaN or decimals."""
    if val is None:
        return None
    try:
        if isinstance(val, float):
            if math.isnan(val):
                return None
            return str(int(val))
        s = str(val).strip()
        if not s or s.lower() in ("nan", "none", "null"):
            return None
        if "." in s:
            f = float(s)
            if math.isnan(f):
                return None
            return str(int(f))
        return str(int(s))
    except (ValueError, TypeError, OverflowError):
        return None

def parse_bedrooms(rooms_en, rooms_ar=None):
    for raw in [rooms_en, rooms_ar]:
        if not raw:
            continue
        s = str(raw).lower().strip()
        if not s or s in ("na", "none", "null", "غير معرف"):
            continue
        if "studio" in s or s == "0" or s == "0 br" or "استوديو" in s:
            return 0
        m = re.search(r'(\d+)', s)
        if m:
            return int(m.group(1))
        if "غرفة" in s and "غرفتان" not in s:
            return 1
        if "غرفتان" in s or "غرفتين" in s:
            return 2
        if "ثلاث" in s:
            return 3
        if "اربع" in s or "أربع" in s:
            return 4
        if "penthouse" in s:
            return 4
        if "duplex" in s:
            return 3
    return None

def clean_title(title: str) -> str:
    if not title:
        return ""
    words = title.strip().split()
    roman = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "1br", "2br", "3br", "4br", "5br"}
    cleaned = []
    for w in words:
        if w.lower() in roman:
            cleaned.append(w.upper())
        elif len(w) <= 2 and w.isupper():
            cleaned.append(w)
        else:
            cleaned.append(w.capitalize())
    return " ".join(cleaned)

# ==============================================================================
# RETIRED / DEPRECATED SCRIPT (Phase 0 Data Contract Remediation - ADR 011)
# ==============================================================================
# This script has been retired as an active ingestion pipeline to eliminate
# transformation drift against the authoritative TypeScript adapter.
#
# AUTHORITATIVE PATH:
# Use scripts/seed-from-duckdb.ts which implements the validated contract boundary.
# ==============================================================================

def main():
    if "--force-unsafe-legacy-run" not in sys.argv:
        print("❌ ERROR: scripts/seed_from_duckdb.py is RETIRED under ADR 011.")
        print("   -> To run the authoritative ingestion path, use: npx tsx scripts/seed-from-duckdb.ts")
        print("   -> To override this safety gate: pass --force-unsafe-legacy-run")
        sys.exit(1)

    print(f"Connecting to DuckDB: {DUCKDB_PATH}")
    duck = duckdb.connect(DUCKDB_PATH)
    
    print(f"Connecting to SQLite: {SQLITE_PATH}")
    sqlite = sqlite3.connect(SQLITE_PATH)
    cur = sqlite.cursor()
    cur.execute("PRAGMA synchronous = OFF")
    cur.execute("PRAGMA journal_mode = WAL")

    # Load English project names from cache if available
    cached_en_names = {}
    if os.path.exists(CACHE_PROJECTS):
        try:
            with open(CACHE_PROJECTS, "r", encoding="utf-8") as f:
                cdata = json.load(f)
                for item in cdata:
                    c_id = safe_int_str(item.get("project_id") or item.get("project_number"))
                    c_name_en = item.get("project_name_en")
                    if c_id and c_name_en:
                        cached_en_names[c_id] = clean_title(c_name_en)
        except Exception:
            pass

    # 1. Source connection
    now = datetime.datetime.now().isoformat()
    cur.execute("""
        INSERT OR IGNORE INTO source_connection (id, name, type, is_active, terms_notes, created_at)
        VALUES ('dld_pipeline_duckdb', 'DLD Pipeline (DuckDB)', 'dld_open_api', 1, 'Local DLD DuckDB pipeline dump', ?)
    """, (now,))
    
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    cur.execute("""
        INSERT INTO ingestion_run (id, source_connection_id, status, started_at, records_fetched, records_inserted, records_skipped)
        VALUES (?, 'dld_pipeline_duckdb', 'running', ?, 0, 0, 0)
    """, (run_id, now))
    sqlite.commit()

    # 2. Seed Projects & Developers & Areas
    print("\n--- Seeding Projects, Developers & Areas ---")
    proj_cur = duck.execute("SELECT * FROM raw_projects")
    cols = [d[0] for d in proj_cur.description]
    proj_rows = proj_cur.fetchall()

    dev_map = {}
    area_map = {}
    num_to_pid = {}
    proj_inserted = 0

    for r in proj_rows:
        row = dict(zip(cols, r))
        
        raw_pid = safe_int_str(row.get("project_id"))
        raw_pnum = safe_int_str(row.get("project_number"))
        if raw_pnum and raw_pid:
            num_to_pid[raw_pnum] = f"proj_dld_{raw_pid}"
        
        dev_id = safe_int_str(row.get("developer_id"))
        dev_name = row.get("developer_name") or "Unknown Developer"
        if dev_id and dev_id not in dev_map:
            dev_pk = f"dev_{dev_id}"
            cur.execute("""
                INSERT OR IGNORE INTO developer (id, legal_name, brand_name, dld_developer_id, source_run_id, first_seen_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (dev_pk, dev_name, dev_name, dev_id, run_id, now, now))
            dev_map[dev_id] = dev_pk

        area_name_en = row.get("area_name_en") or "Dubai"
        area_name_ar = row.get("area_name_ar")
        area_id = safe_int_str(row.get("area_id")) or ""
        if area_name_en not in area_map:
            area_slug = re.sub(r'[^a-zA-Z0-9]', '_', area_name_en).strip('_').lower() or 'dubai'
            area_pk = f"area_{area_id if area_id else area_slug}"
            cur.execute("""
                INSERT OR IGNORE INTO area (id, name_en, name_ar, dld_code, coord_precision, coord_source)
                VALUES (?, ?, ?, ?, 'centroid', 'dld')
            """, (area_pk, area_name_en, area_name_ar, area_id))
            area_map[area_name_en] = area_pk

        p_id = safe_int_str(row.get("project_id") or row.get("project_number"))
        if not p_id:
            continue

        raw_p_name = row.get("project_name_en") or row.get("project_name") or f"Project {p_id}"
        has_arabic = bool(re.search(r'[\u0600-\u06FF]', str(raw_p_name)))
        
        # Determine clean English name
        if p_id in cached_en_names:
            p_name = cached_en_names[p_id]
        elif not has_arabic:
            p_name = clean_title(raw_p_name)
        else:
            p_name = clean_title(row.get("project_description_en") or row.get("master_project_en") or raw_p_name)

        p_name_ar = raw_p_name if has_arabic else row.get("project_name_ar")

        p_status = str(row.get("project_status") or "active").lower()
        if "finish" in p_status or "complete" in p_status:
            status_val = "completed"
        elif "cancel" in p_status:
            status_val = "suspended"
        else:
            status_val = "active"

        pct_val = float(row.get("percent_completed") or 0.0)
        p_pk = f"proj_dld_{p_id}"
        cur.execute("""
            INSERT INTO project (
                id, developer_id, name_en, name_ar, area_id, dld_project_id,
                status, expected_handover_date, handover_date_source,
                construction_progress_pct, escrow_bank_name, escrow_status,
                total_units_reported, research_status, source_run_id, first_seen_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'dld', ?, ?, 'verified_active', ?, 'discovered', ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                developer_id = COALESCE(excluded.developer_id, project.developer_id),
                name_en = CASE WHEN project.name_en IS NULL OR project.name_en = '' THEN excluded.name_en ELSE project.name_en END,
                name_ar = COALESCE(excluded.name_ar, project.name_ar),
                area_id = COALESCE(excluded.area_id, project.area_id),
                status = excluded.status,
                expected_handover_date = CASE WHEN excluded.expected_handover_date != '' THEN excluded.expected_handover_date ELSE project.expected_handover_date END,
                construction_progress_pct = excluded.construction_progress_pct,
                updated_at = excluded.updated_at
        """, (
            p_pk,
            dev_map.get(dev_id),
            p_name,
            p_name_ar,
            area_map.get(area_name_en),
            str(p_id),
            status_val,
            str(row.get("project_end_date") or row.get("completion_date") or ""),
            pct_val,
            row.get("escrow_agent_name"),
            int(row.get("no_of_units") or 0) if row.get("no_of_units") else None,
            run_id,
            now,
            now
        ))
        proj_inserted += 1

    sqlite.commit()
    print(f"Projects processed: {proj_inserted}, Developers: {len(dev_map)}, Areas: {len(area_map)}")

    # 3. Seed Transactions
    print("\n--- Seeding Transactions ---")
    tx_cur = duck.execute("SELECT * FROM raw_transactions_valid")
    tx_cols = [d[0] for d in tx_cur.description]
    
    tx_inserted = 0
    tx_excluded = 0
    batch = []
    non_sale_types = ["mortgage", "gift", "inheritance", "whole building", "bulk"]

    while True:
        chunk = tx_cur.fetchmany(10000)
        if not chunk:
            break
        for r in chunk:
            row = dict(zip(tx_cols, r))
            tx_id = str(row.get("transaction_id"))
            group_en = str(row.get("trans_group_en") or "").lower()
            proc_en = str(row.get("procedure_name_en") or "").lower()
            reg_en = str(row.get("reg_type_en") or "").lower()
            prop_sub_en = str(row.get("property_sub_type_en") or "").lower()
            prop_type_en = str(row.get("property_type_en") or "").lower()

            is_excluded = 0
            exclusion_reason = None
            for nst in non_sale_types:
                if nst in group_en or nst in proc_en:
                    is_excluded = 1
                    exclusion_reason = f"non_sale:{nst}"
                    break
            
            if not is_excluded and ("land" in prop_type_en or "land" in prop_sub_en):
                is_excluded = 1
                exclusion_reason = "land"

            is_off_plan = None
            if "off-plan" in reg_en or "off plan" in reg_en or "pre registration" in proc_en:
                is_off_plan = 1
            elif "ready" in reg_en or "existing" in reg_en:
                is_off_plan = 0

            is_residential = 1 if any(x in prop_sub_en for x in ["flat", "apartment", "studio", "penthouse", "duplex"]) else 0

            area_sqm = float(row.get("procedure_area") or 0.0)
            area_sqft = area_sqm * SQM_TO_SQFT if area_sqm > 0 else None
            val_aed = int(float(row.get("actual_worth") or 0.0))
            psf_aed = (val_aed / area_sqft) if (area_sqft and area_sqft > 0 and val_aed > 0) else None

            p_num = safe_int_str(row.get("project_number"))
            matched_p_pk = num_to_pid.get(p_num) or (f"proj_dld_{p_num}" if p_num else None)

            bedrooms_val = parse_bedrooms(row.get("rooms_en"), row.get("rooms_ar"))

            batch.append((
                tx_id,
                run_id,
                tx_id,
                str(row.get("instance_date") or ""),
                str(row.get("instance_date") or ""),
                row.get("area_name_en"),
                row.get("building_name_en"),
                row.get("project_name_en"),
                p_num,
                bedrooms_val,
                area_sqm,
                area_sqft,
                val_aed,
                psf_aed,
                row.get("procedure_name_en"),
                row.get("property_type_en"),
                row.get("property_sub_type_en"),
                is_off_plan,
                is_residential,
                is_excluded,
                exclusion_reason,
                matched_p_pk,
                "auto" if matched_p_pk else "unmatched"
            ))

            if is_excluded:
                tx_excluded += 1
            else:
                tx_inserted += 1

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
        batch = []
        sqlite.commit()

    print(f"Transactions seeded: {tx_inserted} valid, {tx_excluded} excluded")

    # 4. Seed Service Charges
    print("\n--- Seeding Service Charges ---")
    sc_cur = duck.execute("SELECT * FROM raw_service_charges_valid")
    sc_cols = [d[0] for d in sc_cur.description]
    sc_rows = sc_cur.fetchall()
    sc_batch = []
    for r in sc_rows:
        row = dict(zip(sc_cols, r))
        p_id = safe_int_str(row.get("project_id"))
        sqm_cost = float(row.get("service_cost") or 0.0)
        sqft_cost = sqm_cost / SQM_TO_SQFT if sqm_cost > 0 else 0.0
        sc_id = f"sc_{p_id}_{row.get('budget_year')}_{uuid.uuid4().hex[:6]}"
        sc_batch.append((
            sc_id,
            run_id,
            int(row.get("budget_year") or 2024),
            row.get("property_group_name_en") or row.get("project_name"),
            row.get("master_community_name_en"),
            sqft_cost,
            sqm_cost,
            row.get("service_category_name_en"),
            f"proj_dld_{p_id}" if p_id else None
        ))
    cur.executemany("""
        INSERT OR REPLACE INTO service_charge_fact (
            id, source_run_id, year, building_name_en, area_name_en,
            annual_charge_per_sqft, annual_charge_per_sqm, charge_category, matched_project_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, sc_batch)
    sqlite.commit()
    print(f"Service charges seeded: {len(sc_batch)}")

    # Update ingestion run
    cur.execute("""
        UPDATE ingestion_run
        SET status = 'done', completed_at = ?, records_fetched = ?, records_inserted = ?, records_skipped = ?
        WHERE id = ?
    """, (datetime.datetime.now().isoformat(), tx_inserted + tx_excluded, tx_inserted, tx_excluded, run_id))

    cur.execute("""
        INSERT OR REPLACE INTO data_health_check (
            id, source_connection_id, checked_at, total_records, status, coverage_notes
        ) VALUES (?, 'dld_pipeline_duckdb', ?, ?, 'ok', ?)
    """, (f"health_{run_id}", datetime.datetime.now().isoformat(), tx_inserted, f"Direct seed: {tx_inserted} transactions, {proj_inserted} projects, {len(sc_batch)} service charges"))
    sqlite.commit()

    print("\n🎉 Seed completed successfully!")

if __name__ == "__main__":
    main()
