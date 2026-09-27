#!/usr/bin/env python3
"""
Comprehensive DLD Projects, Villas & Missing Developers Ingestion Engine
1. Ingests all missing areas from DuckDB
2. Fixes Mews Mansions (proj_dld_686016080) -> 5BR Luxury Mansions + 2 real sales
3. Fixes Nad Al Sheba Gardens Phase 10 (proj_dld_782006037 / #3859) -> 201 villas + linked transactions
4. Ingests Greenz By Danube (proj_dld_4430 / #4430) -> 107 transactions, 3BR/4BR/5BR villas
5. Ingests all 320+ missing offplan projects with active transactions from DuckDB
6. Synchronizes unit types and links transactions
"""
import sys
import os
import json
import sqlite3
import datetime
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DUCKDB_PATH = str(ROOT_DIR / "DLD PIPELINE/data/dld.duckdb")
SQLITE_PATH = str(ROOT_DIR / "db/offplan.db")
SQM_TO_SQFT = 10.7639104

# Use DuckDB from venv
import duckdb

def main():
    print(f"🚀 Starting Comprehensive Project & Villa Ingestion...")
    print(f"  DuckDB: {DUCKDB_PATH}")
    print(f"  SQLite: {SQLITE_PATH}")

    duck = duckdb.connect(DUCKDB_PATH, read_only=True)
    sqlite = sqlite3.connect(SQLITE_PATH)
    cur = sqlite.cursor()

    cur.execute("PRAGMA synchronous = OFF")
    cur.execute("PRAGMA journal_mode = WAL")

    # -------------------------------------------------------------------------
    # 1. Ingest Missing Areas from DuckDB
    # -------------------------------------------------------------------------
    print("\n📍 1. Ingesting missing areas...")
    duck_areas = duck.execute("""
        SELECT DISTINCT area_id, area_name_en, area_name_ar
        FROM raw_transactions_valid
        WHERE area_id IS NOT NULL AND area_name_en IS NOT NULL
    """).fetchall()

    area_inserts = []
    for aid, name_en, name_ar in duck_areas:
        area_inserts.append((f"area_{aid}", name_en, name_ar, str(aid)))

    cur.executemany("""
        INSERT OR IGNORE INTO area (id, name_en, name_ar, dld_code)
        VALUES (?, ?, ?, ?)
    """, area_inserts)
    sqlite.commit()
    print(f"  Ensured {len(area_inserts)} areas exist in database.")

    # -------------------------------------------------------------------------
    # 2. Fix Mews Mansions (proj_dld_686016080 / #3416)
    # -------------------------------------------------------------------------
    print("\n🏰 2. Fixing Mews Mansions (proj_dld_686016080)...")
    cur.execute("""
        UPDATE project
        SET property_type = 'villa',
            dld_project_number = '3416',
            total_units_reported = 10,
            master_developer_name = 'Meydan Group',
            operating_developer_name = 'Meydan Group',
            status = 'active',
            construction_progress_pct = 40.33
        WHERE id = 'proj_dld_686016080'
    """)

    # Delete bogus 1BR / 2BR apartments
    cur.execute("DELETE FROM unit_type WHERE project_id = 'proj_dld_686016080'")

    # Insert true 5BR Mansion specification
    now_iso = datetime.datetime.now().isoformat()
    cur.execute("""
        INSERT INTO unit_type (
            id, project_id, bedrooms, unit_type_label, area_sqft_min, area_sqft_max,
            area_type, list_price_aed, net_price_aed, price_source, assignment_policy,
            min_paid_pct_for_noc, updated_at
        ) VALUES (
            'ut_686016080_5', 'proj_dld_686016080', 5, '5BR Luxury Mansion', 25100.0, 25161.0,
            'internal', 72000000, 69500000, 'dld_oqood_actual', 'allowed', 30.0, ?
        )
    """, (now_iso,))

    # Insert 2 actual Mews Mansions transactions
    mews_txs = [
        (
            '1-41-2026-1982', 'run_mews_sync', '1-41-2026-1982', '2026-01-30', '2026-02-02',
            'Nad Al Shiba First', 'Mews Mansions Villa', 'Mews Mansions', '3416',
            5, 1451.22, 25100.0, 69500000, 2768.92,
            'Sell - Pre registration', 'Villa', 'Villa', 1, 1, 0, None,
            'proj_dld_686016080', 'confirmed'
        ),
        (
            '1-41-2025-34446', 'run_mews_sync', '1-41-2025-34446', '2025-12-17', '2025-12-17',
            'Nad Al Shiba First', 'Mews Mansions Villa', 'Mews Mansions', '3416',
            5, 1445.0, 25161.0, 72000000, 2861.57,
            'Sell - Pre registration', 'Villa', 'Villa', 1, 1, 0, None,
            'proj_dld_686016080', 'confirmed'
        ),
    ]

    cur.executemany("""
        INSERT OR REPLACE INTO transaction_fact (
            id, source_run_id, transaction_no, transaction_date, registration_date,
            area_name_en, building_name_en, project_name_en, dld_project_id,
            bedrooms, area_sqm, area_sqft, transaction_value_aed, price_per_sqft_aed,
            transaction_type, property_type, property_subtype, is_off_plan, is_residential,
            is_excluded, exclusion_reason, matched_project_id, match_confidence
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    """, mews_txs)
    sqlite.commit()
    print("  ✅ Mews Mansions updated to 5BR Mansions with 2 real transactions (AED 69.5M, 72M)!")

    # -------------------------------------------------------------------------
    # 3. Fix Nad Al Sheba Gardens Phase 10 (proj_dld_782006037 / #3859)
    # -------------------------------------------------------------------------
    print("\n🏡 3. Updating Nad Al Sheba Gardens Phase 10 (#3859)...")
    cur.execute("""
        UPDATE project
        SET property_type = 'villa',
            dld_project_number = '3859',
            total_units_reported = 201,
            operating_developer_name = 'Meraas (Shamal)',
            master_developer_name = 'Meraas'
        WHERE id = 'proj_dld_782006037'
    """)

    # Update unit types for Nad Al Sheba Gardens Phase 10
    cur.execute("DELETE FROM unit_type WHERE project_id = 'proj_dld_782006037'")
    nash_units = [
        ('ut_782006037_3', 'proj_dld_782006037', 3, '3BR Luxury Townhouse', 2450.0, 3200.0, 'internal', 6463000, 5558000, 'dld_oqood_actual', 'allowed', 30.0, now_iso),
        ('ut_782006037_4', 'proj_dld_782006037', 4, '4BR Standalone Villa', 3800.0, 4600.0, 'internal', 11500000, 9800000, 'dld_oqood_actual', 'allowed', 30.0, now_iso),
        ('ut_782006037_5', 'proj_dld_782006037', 5, '5BR Standalone Villa', 5200.0, 6400.0, 'internal', 15800000, 13900000, 'dld_oqood_actual', 'allowed', 30.0, now_iso),
        ('ut_782006037_6', 'proj_dld_782006037', 6, '6BR Signature Villa', 6800.0, 8200.0, 'internal', 21500000, 19800000, 'dld_oqood_actual', 'allowed', 30.0, now_iso),
        ('ut_782006037_7', 'proj_dld_782006037', 7, '7BR Grand Estate Villa', 8500.0, 10500.0, 'internal', 28000000, 25300000, 'dld_oqood_actual', 'allowed', 30.0, now_iso),
    ]
    cur.executemany("""
        INSERT INTO unit_type (
            id, project_id, bedrooms, unit_type_label, area_sqft_min, area_sqft_max,
            area_type, list_price_aed, net_price_aed, price_source, assignment_policy,
            min_paid_pct_for_noc, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, nash_units)

    # Link all 3859 transactions in transaction_fact
    cur.execute("""
        UPDATE transaction_fact
        SET matched_project_id = 'proj_dld_782006037', match_confidence = 'confirmed'
        WHERE dld_project_id = '3859' OR project_name_en LIKE '%Nad Al Sheba Gardens Phase 10%'
    """)
    sqlite.commit()
    print("  ✅ Nad Al Sheba Gardens Phase 10 configured with 5 Villa/Townhouse unit types and linked transactions.")

    # -------------------------------------------------------------------------
    # 4. Ingest Danube Entity & Greenz By Danube (#4430)
    # -------------------------------------------------------------------------
    print("\n🌿 4. Ingesting Greenz By Danube (#4430)...")
    # Ensure Danube developer brand exists
    cur.execute("""
        INSERT INTO developer (id, legal_name, brand_name, dld_developer_id)
        VALUES ('dev_danube_properties', 'Danube Properties Development LLC', 'Danube Properties', '12777430')
        ON CONFLICT(id) DO UPDATE SET
            legal_name = excluded.legal_name,
            brand_name = excluded.brand_name
    """)

    cur.execute("""
        INSERT INTO project (
            id, developer_id, name_en, name_ar, area_id, dld_project_id, dld_project_number,
            status, property_type, total_units_reported, research_status,
            master_developer_name, operating_developer_name, first_seen_at, updated_at
        ) VALUES (
            'proj_dld_4430', 'dev_danube_properties', 'Greenz By Danube', 'غرينز من دانوب',
            'area_492', '4430', '4430', 'active', 'villa', 104, 'discovered',
            'Danube Properties', 'Danube Properties', ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
            name_en = excluded.name_en,
            name_ar = excluded.name_ar,
            area_id = excluded.area_id,
            dld_project_id = excluded.dld_project_id,
            dld_project_number = excluded.dld_project_number,
            property_type = excluded.property_type,
            operating_developer_name = excluded.operating_developer_name,
            updated_at = excluded.updated_at
    """, (now_iso, now_iso))

    # Unit types for Greenz
    cur.execute("DELETE FROM unit_type WHERE project_id = 'proj_dld_4430'")
    greenz_units = [
        ('ut_4430_3', 'proj_dld_4430', 3, '3BR Luxury Townhouse', 1290.0, 1490.0, 'internal', 3800000, 3470000, 'dld_oqood_actual', 'allowed', 30.0, now_iso),
        ('ut_4430_4', 'proj_dld_4430', 4, '4BR Semi-Detached Villa', 1340.0, 3300.0, 'internal', 4850000, 4460000, 'dld_oqood_actual', 'allowed', 30.0, now_iso),
        ('ut_4430_5', 'proj_dld_4430', 5, '5BR Standalone Villa', 2230.0, 4710.0, 'internal', 6900000, 6300000, 'dld_oqood_actual', 'allowed', 30.0, now_iso),
    ]
    cur.executemany("""
        INSERT INTO unit_type (
            id, project_id, bedrooms, unit_type_label, area_sqft_min, area_sqft_max,
            area_type, list_price_aed, net_price_aed, price_source, assignment_policy,
            min_paid_pct_for_noc, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, greenz_units)

    # Ingest Greenz transactions from DuckDB
    tx_greenz = duck.execute("""
        SELECT 
            transaction_id,
            cast(instance_date as varchar) as tx_date,
            cast(instance_date as varchar) as reg_date,
            area_name_en,
            building_name_en,
            project_name_en,
            cast(project_number as varchar) as p_num,
            rooms_en,
            procedure_area as area_sqm,
            procedure_area * 10.7639104 as area_sqft,
            cast(actual_worth as bigint) as val_aed,
            procedure_name_en,
            property_type_en,
            property_sub_type_en
        FROM raw_transactions_valid
        WHERE project_number = 4430
    """).fetchall()

    greenz_tx_batch = []
    for r in tx_greenz:
        tx_id = str(r[0])
        r_en = str(r[7] or "").lower()
        bed = 3 if "3" in r_en else 4 if "4" in r_en else 5 if "5" in r_en else None
        sqm = float(r[8] or 0.0)
        sqft = float(r[9] or 0.0)
        val = int(r[10] or 0)
        psf = (val / sqft) if sqft > 0 else None
        is_excl = 1 if val > 500000000 else 0 # exclude the portfolio loan registration
        greenz_tx_batch.append((
            tx_id, 'run_greenz_sync', tx_id, str(r[1]), str(r[2]),
            r[3], r[4] or 'Greenz Villa', r[5], '4430',
            bed, sqm, sqft, val, psf,
            r[11], r[12], r[13], 1, 1, is_excl, 'portfolio_mortgage' if is_excl else None,
            'proj_dld_4430', 'confirmed'
        ))

    cur.executemany("""
        INSERT OR REPLACE INTO transaction_fact (
            id, source_run_id, transaction_no, transaction_date, registration_date,
            area_name_en, building_name_en, project_name_en, dld_project_id,
            bedrooms, area_sqm, area_sqft, transaction_value_aed, price_per_sqft_aed,
            transaction_type, property_type, property_subtype, is_off_plan, is_residential,
            is_excluded, exclusion_reason, matched_project_id, match_confidence
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    """, greenz_tx_batch)
    sqlite.commit()
    print(f"  ✅ Greenz By Danube ingested with {len(greenz_tx_batch)} transactions and 3 unit types!")

    # -------------------------------------------------------------------------
    # 5. Ingest All Other Missing Projects with Transactions from DuckDB
    # -------------------------------------------------------------------------
    print("\n🏗️ 5. Ingesting remaining missing projects from DuckDB transactions...")

    # Load existing project numbers
    cur.execute("SELECT dld_project_number, dld_project_id FROM project")
    existing_pnums = set()
    for r in cur.fetchall():
        if r[0]: existing_pnums.add(str(int(float(r[0]))))
        if r[1]: existing_pnums.add(str(int(float(r[1]))))

    duck_missing_projects = duck.execute("""
        SELECT 
            CAST(project_number AS BIGINT) as pnum,
            MAX(project_name_en) as name_en,
            MAX(project_name_ar) as name_ar,
            MAX(area_name_en) as area_name_en,
            MAX(area_id) as area_id,
            count(*) as tx_count,
            min(instance_date) as min_date,
            max(instance_date) as max_date,
            string_agg(DISTINCT property_type_en, ', ') as prop_types
        FROM raw_transactions_valid
        WHERE project_number IS NOT NULL AND project_name_en IS NOT NULL
        GROUP BY CAST(project_number AS BIGINT)
    """).fetchall()

    new_projects = []
    for r in duck_missing_projects:
        pnum = str(r[0])
        if pnum in existing_pnums:
            continue

        name_en = r[1]
        name_ar = r[2]
        area_en = r[3]
        area_id = f"area_{r[4]}" if r[4] else None
        tx_cnt = r[5]
        min_d = str(r[6])
        max_d = str(r[7])
        prop_types = str(r[8] or "").lower()

        is_villa = "villa" in prop_types or "townhouse" in name_en.lower() or "villas" in name_en.lower()
        property_type = "villa" if is_villa else "apartment"

        # Detect developer brand
        dev_brand = "Independent Developer"
        dev_id = "dev_independent"
        nl = name_en.lower()
        if "danube" in nl:
            dev_brand = "Danube Properties"
            dev_id = "dev_danube_properties"
        elif "binghatti" in nl:
            dev_brand = "Binghatti Developers"
            dev_id = "dev_binghatti"
        elif "damac" in nl:
            dev_brand = "DAMAC Properties"
            dev_id = "dev_damac"
        elif "sobha" in nl:
            dev_brand = "Sobha Realty"
            dev_id = "dev_sobha"
        elif "emaar" in nl:
            dev_brand = "Emaar Properties"
            dev_id = "dev_emaar"
        elif "meraas" in nl:
            dev_brand = "Meraas"
            dev_id = "dev_meraas"
        elif "nakheel" in nl:
            dev_brand = "Nakheel"
            dev_id = "dev_nakheel"
        elif "azizi" in nl:
            dev_brand = "Azizi Developments"
            dev_id = "dev_azizi"
        elif "imtiaz" in nl:
            dev_brand = "Imtiaz Developments"
            dev_id = "dev_imtiaz"
        elif "beyond" in nl or "omniyat" in nl:
            dev_brand = "Omniyat"
            dev_id = "dev_omniyat"
        elif "ellington" in nl:
            dev_brand = "Ellington Properties"
            dev_id = "dev_ellington"

        pid = f"proj_dld_{pnum}"
        new_projects.append((
            pid, dev_id, name_en, name_ar, area_id, pnum, pnum,
            'active', property_type, tx_cnt, 'discovered',
            dev_brand, dev_brand, min_d, max_d
        ))

    print(f"  Inserting {len(new_projects)} new projects into SQLite...")
    cur.executemany("""
        INSERT INTO project (
            id, developer_id, name_en, name_ar, area_id, dld_project_id, dld_project_number,
            status, property_type, total_units_reported, research_status,
            master_developer_name, operating_developer_name, first_seen_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name_en = excluded.name_en,
            name_ar = excluded.name_ar,
            area_id = excluded.area_id,
            dld_project_id = excluded.dld_project_id,
            dld_project_number = excluded.dld_project_number,
            property_type = excluded.property_type,
            operating_developer_name = excluded.operating_developer_name,
            updated_at = excluded.updated_at
    """, new_projects)
    sqlite.commit()
    print(f"  ✅ Inserted {len(new_projects)} new projects!")

    # Ingest transactions for these newly added projects
    new_pnum_set = {p[5] for p in new_projects}
    if new_pnum_set:
        print(f"  Streaming and inserting transactions for {len(new_pnum_set)} new projects...")
        pnum_list_str = ",".join(new_pnum_set)
        tx_rows = duck.execute(f"""
            SELECT 
                transaction_id,
                cast(instance_date as varchar) as tx_date,
                cast(instance_date as varchar) as reg_date,
                area_name_en,
                building_name_en,
                project_name_en,
                cast(project_number as varchar) as p_num,
                rooms_en,
                procedure_area as area_sqm,
                procedure_area * 10.7639104 as area_sqft,
                cast(actual_worth as bigint) as val_aed,
                procedure_name_en,
                property_type_en,
                property_sub_type_en
            FROM raw_transactions_valid
            WHERE project_number IN ({pnum_list_str})
        """).fetchall()

        bulk_tx = []
        project_unit_stats = {} # pid -> {bedrooms: [prices, areas]}
        for r in tx_rows:
            tx_id = str(r[0])
            p_num = str(r[6]).split(".")[0] if r[6] else None
            if not p_num: continue
            pid = f"proj_dld_{p_num}"

            r_en = str(r[7] or "").lower()
            bed = None
            if "studio" in r_en or r_en == "0": bed = 0
            elif "1" in r_en: bed = 1
            elif "2" in r_en: bed = 2
            elif "3" in r_en: bed = 3
            elif "4" in r_en: bed = 4
            elif "5" in r_en: bed = 5
            elif "6" in r_en: bed = 6
            elif "7" in r_en: bed = 7

            sqm = float(r[8] or 0.0)
            sqft = float(r[9] or 0.0)
            val = int(r[10] or 0)
            psf = (val / sqft) if sqft > 0 else None
            is_excl = 1 if val > 200000000 or val <= 0 else 0

            bulk_tx.append((
                tx_id, 'run_missing_projects_sync', tx_id, str(r[1]), str(r[2]),
                r[3], r[4], r[5], p_num,
                bed, sqm, sqft, val, psf,
                r[11], r[12], r[13], 1, 1, is_excl, 'large_bulk_or_invalid' if is_excl else None,
                pid, 'confirmed'
            ))

            if bed is not None and val > 0 and sqft > 0 and not is_excl:
                if pid not in project_unit_stats: project_unit_stats[pid] = {}
                if bed not in project_unit_stats[pid]: project_unit_stats[pid][bed] = {'prices': [], 'areas': []}
                project_unit_stats[pid][bed]['prices'].append(val)
                project_unit_stats[pid][bed]['areas'].append(sqft)

        print(f"  Inserting {len(bulk_tx)} transactions...")
        cur.executemany("""
            INSERT OR REPLACE INTO transaction_fact (
                id, source_run_id, transaction_no, transaction_date, registration_date,
                area_name_en, building_name_en, project_name_en, dld_project_id,
                bedrooms, area_sqm, area_sqft, transaction_value_aed, price_per_sqft_aed,
                transaction_type, property_type, property_subtype, is_off_plan, is_residential,
                is_excluded, exclusion_reason, matched_project_id, match_confidence
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        """, bulk_tx)
        sqlite.commit()
        print(f"  ✅ Successfully inserted {len(bulk_tx)} transactions for new projects!")

        # Create unit types for new projects from actual transactions
        unit_type_inserts = []
        for pid, beds_map in project_unit_stats.items():
            for bed, data in beds_map.items():
                if not data['prices']: continue
                min_price = min(data['prices'])
                max_price = max(data['prices'])
                avg_price = int(sum(data['prices']) / len(data['prices']))
                min_sqft = round(min(data['areas']), 1)
                max_sqft = round(max(data['areas']), 1)
                label = f"{bed}BR Suite" if bed > 0 else "Studio"
                ut_id = f"ut_{pid.replace('proj_dld_', '')}_{bed}"
                unit_type_inserts.append((
                    ut_id, pid, bed, label, min_sqft, max_sqft,
                    'internal', max_price, avg_price, 'dld_oqood_actual', 'allowed', 30.0, now_iso
                ))

        if unit_type_inserts:
            print(f"  Inserting {len(unit_type_inserts)} synthesized real unit types for new projects...")
            cur.executemany("""
                INSERT OR REPLACE INTO unit_type (
                    id, project_id, bedrooms, unit_type_label, area_sqft_min, area_sqft_max,
                    area_type, list_price_aed, net_price_aed, price_source, assignment_policy,
                    min_paid_pct_for_noc, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, unit_type_inserts)
            sqlite.commit()
            print(f"  ✅ Inserted {len(unit_type_inserts)} unit types!")

    # -------------------------------------------------------------------------
    # 6. Final Verification Counts
    # -------------------------------------------------------------------------
    cur.execute("SELECT count(*) FROM project")
    total_projects = cur.fetchone()[0]
    cur.execute("SELECT property_type, count(*) FROM project GROUP BY property_type")
    type_counts = cur.fetchall()
    cur.execute("SELECT count(*) FROM transaction_fact WHERE matched_project_id IS NOT NULL")
    matched_tx = cur.fetchone()[0]

    print("\n🎯 Ingestion Complete!")
    print(f"  Total Projects in Database: {total_projects:,}")
    print(f"  Breakdown: {type_counts}")
    print(f"  Total Linked Transactions: {matched_tx:,}")

    # Specific checks
    for test_id in ['proj_dld_686016080', 'proj_dld_782006037', 'proj_dld_4430']:
        cur.execute("SELECT id, name_en, property_type, dld_project_number, operating_developer_name FROM project WHERE id = ?", (test_id,))
        p = cur.fetchone()
        cur.execute("SELECT count(*) FROM unit_type WHERE project_id = ?", (test_id,))
        u = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM transaction_fact WHERE matched_project_id = ?", (test_id,))
        t = cur.fetchone()[0]
        print(f"  Check {test_id}: {p} | Units: {u} | Transactions: {t}")

    sqlite.close()
    duck.close()

if __name__ == "__main__":
    main()
