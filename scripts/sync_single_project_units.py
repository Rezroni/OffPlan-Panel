import sys
import os
from pathlib import Path

# Self-reexec with virtualenv python if needed
ROOT_DIR = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT_DIR / "DLD PIPELINE" / ".venv" / "bin" / "python"
if VENV_PYTHON.exists() and sys.executable != str(VENV_PYTHON):
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON)] + sys.argv)

dld_dir = str(ROOT_DIR / "DLD PIPELINE")
if dld_dir not in sys.path:
    sys.path.insert(0, dld_dir)

import json
import sqlite3
import re
import datetime
import statistics
from collections import defaultdict
import requests
from dld.auth import get_access_token, security_application_identifier
from dld.config import load_env

from typing import Optional

NON_RESIDENTIAL_SUBTYPES = {"shop", "office", "store", "showroom", "retail", "warehouse", "hotel room", "hotel apartment"}

def clean_title(title: str) -> str:
    """Format all-caps or messy titles into clean Title Case."""
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

def parse_bedrooms(rooms_str: str) -> Optional[int]:
    if not rooms_str:
        return None
    s = str(rooms_str).strip().lower()
    if s in ["na", "none", "null", "غير معرف", ""]:
        return None
    if "studio" in s or s == "0" or "استوديو" in s:
        return 0
    m = re.search(r"(\d+)", s)
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
    return None

def sync_project_units(project_id: str, dld_id: str):
    env = load_env()
    base_url = env.get("DATA_DUBAI_API_BASE_URL", "https://apis.data.dubai/")
    token = get_access_token()
    sec_id = security_application_identifier()

    clean_dld_id = str(dld_id).split(".")[0].strip()

    url = base_url.rstrip("/") + "/open/dld/dld_units-open-api"
    headers = {
        "x-DDA-SecurityApplicationIdentifier": sec_id,
        "Authorization": f"Bearer {token}",
    }

    resp = requests.get(
        url,
        params={"page": 1, "pageSize": 1000, "filter": f"project_id = {clean_dld_id}"},
        headers=headers,
        timeout=30,
    )
    if resp.status_code == 401:
        token = get_access_token(force_refresh=True)
        headers["Authorization"] = f"Bearer {token}"
        resp = requests.get(
            url,
            params={"page": 1, "pageSize": 1000, "filter": f"project_id = {clean_dld_id}"},
            headers=headers,
            timeout=30,
        )

    results = resp.json().get("results", []) if resp.status_code == 200 else []

    sqlite = sqlite3.connect("db/offplan.db")
    cur = sqlite.cursor()

    if not results:
        print("NO_UNITS_FOUND")
        sqlite.close()
        return

    # Check project metadata (name, area)
    cur.execute("SELECT name_en, area_id FROM project WHERE id = ?", (project_id,))
    proj_row = cur.fetchone()
    current_proj_name = proj_row[0] if proj_row else ""
    area_id = proj_row[1] if proj_row else ""

    area_name = ""
    if area_id:
        cur.execute("SELECT name_en FROM area WHERE id = ?", (area_id,))
        arow = cur.fetchone()
        if arow:
            area_name = arow[0]

    # Check if DLD units have English project name and update project table if needed
    dld_p_name_en = next((r.get("project_name_en") for r in results if r.get("project_name_en")), None)
    if dld_p_name_en:
        formatted_name = clean_title(dld_p_name_en)
        cur.execute("UPDATE project SET name_en = ? WHERE id = ?", (formatted_name, project_id))
        current_proj_name = formatted_name

    # Group residential units strictly by integer bedroom count (0: Studio, 1: 1BR, 2: 2BR...)
    by_bedrooms = defaultdict(list)
    for r in results:
        sub_type = str(r.get("property_sub_type_en") or "").lower()
        if sub_type in NON_RESIDENTIAL_SUBTYPES:
            continue
        
        rooms_raw = r.get("rooms_en") or r.get("rooms_ar") or str(r.get("rooms", ""))
        br_num = parse_bedrooms(rooms_raw)
        if br_num is None:
            continue

        by_bedrooms[br_num].append(r)

    cur.execute("DELETE FROM unit_type WHERE project_id = ?", (project_id,))
    now = datetime.datetime.now().isoformat()
    inserted_count = 0

    for br_num in sorted(by_bedrooms.keys()):
        units = by_bedrooms[br_num]
        br_label = "Studio" if br_num == 0 else f"{br_num}BR"

        areas = [float(u["actual_area"]) * 10.7639104 for u in units if u.get("actual_area")]
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
        """, (project_id, clean_dld_id, current_proj_name.lower(), br_num))
        deals = cur.fetchall()

        if deals:
            # We have verified real Oqood transactions!
            deal_count = len(deals)
            first_deal = deals[0]
            first_deal_date = first_deal[0]
            first_deal_price = int(first_deal[1])
            first_deal_psf = float(first_deal[2]) if first_deal[2] else 0.0

            # First deal is official registered launch contract price
            net_price = first_deal_price
            list_price = round(first_deal_price / 0.96)
            price_source = "dld_oqood_verified"
            price_as_of = first_deal_date
            type_label = f"{br_label} ({len(units)} units · {deal_count} Oqood deals)"
        else:
            # Check if there are area-level Oqood comps
            area_deals = []
            if area_name:
                cur.execute("""
                    SELECT price_per_sqft_aed
                    FROM transaction_fact
                    WHERE area_name_en = ?
                      AND bedrooms = ?
                      AND is_off_plan = 1
                      AND is_excluded = 0
                      AND price_per_sqft_aed > 0
                """, (area_name, br_num))
                area_deals = [r[0] for r in cur.fetchall() if r[0]]

            if len(area_deals) >= 3:
                med_psf = statistics.median(area_deals)
                list_price = round(avg_sqft * med_psf)
                net_price = round(list_price * 0.96)
                price_source = "area_oqood_comps"
                price_as_of = now
                type_label = f"{br_label} ({len(units)} units in DLD)"
            else:
                # Baseline estimate
                est_psf = 1950 if br_num == 0 else 1850 if br_num == 1 else 1750 if br_num == 2 else 1650
                list_price = round(avg_sqft * est_psf)
                net_price = round(list_price * 0.96)
                price_source = "synthetic_estimate"
                price_as_of = now
                type_label = f"{br_label} ({len(units)} units in DLD)"

        ut_id = f"ut_{clean_dld_id}_{br_num}_{len(units)}"

        cur.execute(
            """
            INSERT OR REPLACE INTO unit_type (
                id, project_id, bedrooms, unit_type_label,
                area_sqft_min, area_sqft_max, area_type,
                list_price_aed, net_price_aed, price_source, price_as_of,
                assignment_policy, min_paid_pct_for_noc, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'internal', ?, ?, ?, ?, 'allowed', 34, ?)
            """,
            (ut_id, project_id, br_num, type_label, min_sqft, max_sqft, list_price, net_price, price_source, price_as_of, now),
        )
        inserted_count += 1

    sqlite.commit()
    sqlite.close()
    print(f"SUCCESS:{inserted_count}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python sync_single_project_units.py <project_id> <dld_id>")
        sys.exit(1)
    sync_project_units(sys.argv[1], sys.argv[2])
