#!/usr/bin/env python3
"""
Fetch full real unit line-ups from DLD Units API (dld_units-open-api)
and populate unit_type table in db/offplan.db with exact bedroom counts,
real sqft ranges, and unit counts.
"""
import sys
import os
from pathlib import Path

# Self-reexec with virtualenv python if needed
ROOT_DIR = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT_DIR / "DLD PIPELINE" / ".venv" / "bin" / "python"
if VENV_PYTHON.exists() and sys.executable != str(VENV_PYTHON):
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON)] + sys.argv)

# Add DLD PIPELINE to sys.path for dld module imports
dld_dir = str(ROOT_DIR / "DLD PIPELINE")
if dld_dir not in sys.path:
    sys.path.insert(0, dld_dir)

import warnings
warnings.filterwarnings("ignore")

import sqlite3
import datetime
import re
import requests
import time
import statistics
from collections import defaultdict

from dld.auth import get_access_token, security_application_identifier
from dld.config import load_env

SQLITE_PATH = str(ROOT_DIR / "db/offplan.db")
SQM_TO_SQFT = 10.7639104

def parse_bedrooms_label(rooms_str):
    if not rooms_str:
        return None, "Unit"
    s = str(rooms_str).lower().strip()
    if "studio" in s or s == "0" or s == "0 br" or "استوديو" in s:
        return 0, "Studio"
    m = re.search(r'(\d+)', s)
    if m:
        n = int(m.group(1))
        return n, f"{n}BR"
    if "غرفة" in s and "غرفتان" not in s:
        return 1, "1BR"
    if "غرفتان" in s or "غرفتين" in s:
        return 2, "2BR"
    if "ثلاث" in s:
        return 3, "3BR"
    if "اربع" in s or "أربع" in s:
        return 4, "4BR"
    if "penthouse" in s:
        return 4, "Penthouse"
    if "duplex" in s:
        return 3, "Duplex"
    return None, str(rooms_str)

def main():
    print("🚀 Fetching Real Unit Line-ups from DLD (dld_units-open-api)...")
    env = load_env()
    base_url = env.get("DATA_DUBAI_API_BASE_URL", "https://apis.data.dubai/")
    token = get_access_token()
    sec_id = security_application_identifier()

    url = base_url.rstrip("/") + "/open/dld/dld_units-open-api"
    headers = {
        "x-DDA-SecurityApplicationIdentifier": sec_id,
        "Authorization": f"Bearer {token}",
    }

    sqlite = sqlite3.connect(SQLITE_PATH)
    cur = sqlite.cursor()

    # Get target projects (focus on active and popular projects with dld_project_id)
    cur.execute("""
        SELECT id, dld_project_id, name_en, area_id
        FROM project
        WHERE dld_project_id IS NOT NULL
        ORDER BY 
            CASE WHEN status = 'active' THEN 0 ELSE 1 END,
            total_units_reported DESC
        LIMIT 60
    """)
    projects_to_sync = cur.fetchall()
    print(f"Syncing real unit line-ups for {len(projects_to_sync)} priority projects...")

    now = datetime.datetime.now().isoformat()
    total_unit_types_inserted = 0

    for proj_pk, dld_id, name_en, area_id in projects_to_sync:
        try:
            # Query DLD units API for this project
            time.sleep(1.1)
            clean_dld_id = str(dld_id).split(".")[0].strip()
            resp = requests.get(
                url,
                params={"page": 1, "pageSize": 1000, "filter": f"project_id = {clean_dld_id}"},
                headers=headers,
                timeout=30
            )
            if resp.status_code == 401:
                token = get_access_token(force_refresh=True)
                headers["Authorization"] = f"Bearer {token}"
                resp = requests.get(
                    url,
                    params={"page": 1, "pageSize": 1000, "filter": f"project_id = {clean_dld_id}"},
                    headers=headers,
                    timeout=30
                )

            if resp.status_code != 200:
                print(f"  Project {clean_dld_id} ({name_en}): API returned status {resp.status_code}")
                continue

            results = resp.json().get("results", [])
            if not results:
                continue

            # Exclude commercial/retail units and group strictly by bedroom count
            NON_RES = {"shop", "office", "store", "showroom", "retail", "warehouse", "hotel room", "hotel apartment"}
            by_bedrooms = defaultdict(list)
            for r in results:
                sub_type = str(r.get("property_sub_type_en") or "").lower()
                if sub_type in NON_RES:
                    continue
                rooms_raw = r.get("rooms_en") or r.get("rooms_ar") or str(r.get("rooms", ""))
                br_num, _ = parse_bedrooms_label(rooms_raw)
                if br_num is None:
                    continue
                by_bedrooms[br_num].append(r)

            if not by_bedrooms:
                continue

            # Update English project name if available
            p_en = next((r.get("project_name_en") for r in results if r.get("project_name_en")), None)
            if p_en:
                cur.execute("UPDATE project SET name_en = ? WHERE id = ?", (p_en.strip().title(), proj_pk))

            # Delete previous placeholder unit types for this project only when valid units found
            cur.execute("DELETE FROM unit_type WHERE project_id = ?", (proj_pk,))

            # Insert real aggregated unit types
            inserted_for_proj = 0
            for br_num in sorted(by_bedrooms.keys()):
                units = by_bedrooms[br_num]
                br_label = "Studio" if br_num == 0 else f"{br_num}BR"
                areas = [
                    float(u["actual_area"]) * SQM_TO_SQFT
                    for u in units
                    if u.get("actual_area") and float(u["actual_area"]) > 0
                ]
                if not areas:
                    continue

                min_sqft = round(min(areas))
                max_sqft = round(max(areas))
                avg_sqft = round(sum(areas) / len(areas))

                # Check for REAL registered Oqood (Pre-registration) deals for this project & bedroom count
                cur.execute("""
                    SELECT transaction_date, transaction_value_aed, price_per_sqft_aed, area_sqft, transaction_no
                    FROM transaction_fact
                    WHERE (matched_project_id = ? OR dld_project_id = ? OR lower(project_name_en) = ?)
                      AND bedrooms = ?
                      AND is_off_plan = 1
                      AND is_excluded = 0
                      AND transaction_value_aed > 0
                    ORDER BY transaction_date ASC, transaction_value_aed ASC
                """, (proj_pk, clean_dld_id, name_en.lower(), br_num))
                deals = cur.fetchall()

                if deals:
                    deal_count = len(deals)
                    first_deal = deals[0]
                    first_deal_date = first_deal[0]
                    first_deal_price = int(first_deal[1])
                    net_price = first_deal_price
                    list_price = round(first_deal_price / 0.96)
                    price_source = "dld_oqood_verified"
                    price_as_of = first_deal_date
                    type_label = f"{br_label} ({len(units)} units · {deal_count} Oqood deals)"
                else:
                    area_deals = []
                    if area_id:
                        cur.execute("""
                            SELECT price_per_sqft_aed
                            FROM transaction_fact
                            WHERE area_name_en = (SELECT name_en FROM area WHERE id = ?)
                              AND bedrooms = ?
                              AND is_off_plan = 1
                              AND is_excluded = 0
                              AND price_per_sqft_aed > 0
                        """, (area_id, br_num))
                        area_deals = [r[0] for r in cur.fetchall() if r[0]]

                    if len(area_deals) >= 3:
                        med_psf = statistics.median(area_deals)
                        list_price = round(avg_sqft * med_psf)
                        net_price = round(list_price * 0.96)
                        price_source = "area_oqood_comps"
                        price_as_of = now
                        type_label = f"{br_label} ({len(units)} units in DLD)"
                    else:
                        est_psf = 1950 if br_num == 0 else 1850 if br_num == 1 else 1750 if br_num == 2 else 1650
                        list_price = round(avg_sqft * est_psf)
                        net_price = round(list_price * 0.96)
                        price_source = "synthetic_estimate"
                        price_as_of = now
                        type_label = f"{br_label} ({len(units)} units in DLD)"

                ut_id = f"ut_{clean_dld_id}_{br_num}_{len(units)}"

                cur.execute("""
                    INSERT OR REPLACE INTO unit_type (
                        id, project_id, bedrooms, unit_type_label,
                        area_sqft_min, area_sqft_max, area_type,
                        list_price_aed, net_price_aed, price_source, price_as_of,
                        assignment_policy, min_paid_pct_for_noc, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'internal', ?, ?, ?, ?, 'allowed', 34, ?)
                """, (
                    ut_id, proj_pk, br_num, type_label,
                    min_sqft, max_sqft, list_price, net_price,
                    price_source, price_as_of, now
                ))
                total_unit_types_inserted += 1
                inserted_for_proj += 1

            sqlite.commit()
            print(f"  ✅ Project {clean_dld_id} ({name_en}): inserted {inserted_for_proj} real unit types from {len(results)} DLD units")

        except Exception as e:
            print(f"  ❌ Project {dld_id} error: {e}")

    print(f"\n🎉 Done! Inserted {total_unit_types_inserted} real unit types into db/offplan.db")

if __name__ == "__main__":
    main()
