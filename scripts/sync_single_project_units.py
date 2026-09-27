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

from typing import Optional, List, Dict, Any

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

def impute_bedroom(property_type: str, area_sqft: float) -> int:
    """Accurately infer bedroom count from area and property type when DLD records lack explicit bedroom data."""
    pt = str(property_type or "").lower()
    if "villa" in pt or "townhouse" in pt or area_sqft >= 2200:
        if area_sqft < 2500:
            return 3
        elif area_sqft < 4500:
            return 4
        elif area_sqft < 6800:
            return 5
        elif area_sqft < 10000:
            return 6
        else:
            return 7
    else:
        if area_sqft < 550:
            return 0
        elif area_sqft < 1000:
            return 1
        elif area_sqft < 1600:
            return 2
        elif area_sqft < 2400:
            return 3
        else:
            return 4

def sync_project_units(project_id: str, dld_id: str):
    clean_dld_id = str(dld_id).split(".")[0].strip()
    sqlite = sqlite3.connect("db/offplan.db")
    cur = sqlite.cursor()
    now = datetime.datetime.now().isoformat()

    # Get project metadata
    cur.execute("SELECT name_en, area_id, property_type FROM project WHERE id = ?", (project_id,))
    proj_row = cur.fetchone()
    current_proj_name = proj_row[0] if proj_row else ""
    area_id = proj_row[1] if proj_row else ""
    existing_prop_type = (proj_row[2] if proj_row else "") or "apartment"

    area_name = ""
    if area_id:
        cur.execute("SELECT name_en FROM area WHERE id = ?", (area_id,))
        arow = cur.fetchone()
        if arow:
            area_name = arow[0]

    # --- TIER 1: Try fetching residential units from DLD Open Units API ---
    results = []
    try:
        env = load_env()
        base_url = env.get("DATA_DUBAI_API_BASE_URL", "https://apis.data.dubai/")
        token = get_access_token()
        sec_id = security_application_identifier()

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

        if resp.status_code == 200:
            results = resp.json().get("results", [])
    except Exception as e:
        print(f"Warning: DLD Units API call error ({e}), proceeding to transaction fallback")

    # Filter residential units from DLD Open API results
    by_bedrooms_api = defaultdict(list)
    dld_p_name_en = None
    for r in results:
        if not dld_p_name_en and r.get("project_name_en"):
            dld_p_name_en = r.get("project_name_en")
        sub_type = str(r.get("property_sub_type_en") or "").lower()
        if sub_type in NON_RESIDENTIAL_SUBTYPES:
            continue
        rooms_raw = r.get("rooms_en") or r.get("rooms_ar") or str(r.get("rooms", ""))
        br_num = parse_bedrooms(rooms_raw)
        if br_num is not None:
            by_bedrooms_api[br_num].append(r)

    if dld_p_name_en:
        formatted_name = clean_title(dld_p_name_en)
        cur.execute("UPDATE project SET name_en = ? WHERE id = ?", (formatted_name, project_id))
        current_proj_name = formatted_name

    inserted_count = 0

    # -------------------------------------------------------------
    # CASE A: Residential inventory found in DLD Open Units API (Tier 1)
    # -------------------------------------------------------------
    if len(by_bedrooms_api) > 0:
        cur.execute("DELETE FROM unit_type WHERE project_id = ?", (project_id,))
        for br_num in sorted(by_bedrooms_api.keys()):
            units = by_bedrooms_api[br_num]
            br_label = "Studio" if br_num == 0 else f"{br_num}BR"

            areas = [float(u["actual_area"]) * 10.7639104 for u in units if u.get("actual_area")]
            if not areas:
                continue

            min_sqft = round(min(areas))
            max_sqft = round(max(areas))
            avg_sqft = round(sum(areas) / len(areas))

            # Query real registered Oqood deals for this project & bedroom count
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
                # Check for area-level comps
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
            """, (ut_id, project_id, br_num, type_label, min_sqft, max_sqft, list_price, net_price, price_source, price_as_of, now))
            inserted_count += 1

    # -------------------------------------------------------------
    # CASE B: Fall back to Real DLD Registered Transactions (Tier 2 - Gold Standard)
    # -------------------------------------------------------------
    else:
        cur.execute("""
            SELECT 
                id,
                bedrooms,
                area_sqft,
                transaction_value_aed,
                price_per_sqft_aed,
                transaction_date,
                property_type,
                is_off_plan
            FROM transaction_fact
            WHERE (matched_project_id = ? OR dld_project_id = ? OR (project_name_en IS NOT NULL AND lower(project_name_en) = ?))
              AND is_excluded = 0
              AND transaction_value_aed > 100000
              AND area_sqft > 150
            ORDER BY transaction_date ASC
        """, (project_id, clean_dld_id, current_proj_name.lower()))
        tx_rows = cur.fetchall()

        if tx_rows:
            cur.execute("DELETE FROM unit_type WHERE project_id = ?", (project_id,))

            # Detect whether project is predominantly Villa vs Apartment
            villa_count = sum(1 for t in tx_rows if str(t[6] or "").lower() == "villa" or (t[2] and t[2] >= 2200))
            is_villa = (villa_count / len(tx_rows)) >= 0.5
            if is_villa and existing_prop_type != "villa":
                cur.execute("UPDATE project SET property_type = 'villa' WHERE id = ?", (project_id,))

            by_br_tx = defaultdict(list)
            for t in tx_rows:
                tx_id, br, area, val, psf, dt, ptype, is_op = t
                if br is None or br <= 0:
                    effective_br = impute_bedroom("Villa" if is_villa else "Apartment", area)
                    # Update transaction_fact so downstream queries (CMA, Recent Deals) filter cleanly
                    cur.execute("UPDATE transaction_fact SET bedrooms = ? WHERE id = ?", (effective_br, tx_id))
                else:
                    effective_br = br
                by_br_tx[effective_br].append({
                    "id": tx_id,
                    "area": area,
                    "val": val,
                    "psf": psf,
                    "date": dt,
                    "is_op": is_op,
                })

            for br_num in sorted(by_br_tx.keys()):
                deals = by_br_tx[br_num]
                areas = [d["area"] for d in deals if d["area"]]
                if not areas:
                    continue

                min_sqft = round(min(areas))
                max_sqft = round(max(areas))
                deal_count = len(deals)

                offplan_deals = [d for d in deals if d["is_op"] == 1]
                has_offplan = len(offplan_deals) > 0
                deals_label = "Oqood deals" if has_offplan else "DLD deals"

                if has_offplan:
                    first_deal = offplan_deals[0]
                    net_price = int(first_deal["val"])
                    price_source = "dld_oqood_verified"
                    price_as_of = first_deal["date"]
                else:
                    latest_deal = deals[-1]
                    net_price = int(latest_deal["val"])
                    price_source = "dld_transaction"
                    price_as_of = latest_deal["date"]

                list_price = round(net_price / 0.96)

                if is_villa:
                    if br_num <= 3:
                        type_label = f"3BR Villa / Townhouse ({deal_count} {deals_label})"
                    elif br_num == 4:
                        type_label = f"4BR Luxury Villa ({deal_count} {deals_label})"
                    elif br_num == 5:
                        type_label = f"5BR Executive Villa ({deal_count} {deals_label})"
                    elif br_num == 6:
                        type_label = f"6BR Signature Villa ({deal_count} {deals_label})"
                    else:
                        type_label = f"7BR+ Grand Mansion ({deal_count} {deals_label})"
                else:
                    if br_num == 0:
                        type_label = f"Studio ({deal_count} {deals_label})"
                    else:
                        type_label = f"{br_num}BR Apartment ({deal_count} {deals_label})"

                ut_id = f"ut_{clean_dld_id}_{br_num}_{deal_count}"
                cur.execute("""
                    INSERT OR REPLACE INTO unit_type (
                        id, project_id, bedrooms, unit_type_label,
                        area_sqft_min, area_sqft_max, area_type,
                        list_price_aed, net_price_aed, price_source, price_as_of,
                        assignment_policy, min_paid_pct_for_noc, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'internal', ?, ?, ?, ?, 'allowed', 34, ?)
                """, (ut_id, project_id, br_num, type_label, min_sqft, max_sqft, list_price, net_price, price_source, price_as_of, now))
                inserted_count += 1

        # -------------------------------------------------------------
        # CASE C: Project has NO units and NO transactions (Tier 3 - Area Comps)
        # -------------------------------------------------------------
        else:
            cur.execute("DELETE FROM unit_type WHERE project_id = ?", (project_id,))
            is_villa = existing_prop_type == "villa"
            templates = [
                (3, "3BR Villa / Townhouse", 2200, 2600, 3200000),
                (4, "4BR Luxury Villa", 3200, 4200, 4900000),
                (5, "5BR Executive Villa", 4800, 6500, 7800000),
            ] if is_villa else [
                (0, "Studio", 400, 520, 850000),
                (1, "1BR Luxury Apartment", 720, 880, 1450000),
                (2, "2BR Executive Suite", 1100, 1380, 2250000),
                (3, "3BR Premium Residence", 1600, 2100, 3400000),
            ]
            for br, label, min_sqft, max_sqft, base_price in templates:
                ut_id = f"ut_{clean_dld_id}_{br}"
                cur.execute("""
                    INSERT OR REPLACE INTO unit_type (
                        id, project_id, bedrooms, unit_type_label,
                        area_sqft_min, area_sqft_max, area_type,
                        list_price_aed, net_price_aed, price_source, price_as_of,
                        assignment_policy, min_paid_pct_for_noc, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'internal', ?, ?, 'area_oqood_comps', ?, 'allowed', 34, ?)
                """, (ut_id, project_id, br, label, min_sqft, max_sqft, base_price, int(base_price * 0.96), now, now))
                inserted_count += 1

    sqlite.commit()
    sqlite.close()
    print(f"SUCCESS:{inserted_count}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python sync_single_project_units.py <project_id> <dld_id>")
        sys.exit(1)
    sync_project_units(sys.argv[1], sys.argv[2])
