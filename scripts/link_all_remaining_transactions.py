#!/usr/bin/env python3
"""
Link 100% of Transactions to Canonical Projects (Off-plan, Existing Buildings & District Residential)
"""

import sqlite3
import hashlib
import re
from datetime import datetime
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = str(ROOT_DIR / "db/offplan.db")

def make_slug_id(prefix: str, text: str) -> str:
    h = hashlib.md5(text.lower().strip().encode("utf-8")).hexdigest()[:12]
    clean_name = re.sub(r'[^a-zA-Z0-9]+', '_', text.strip()).strip('_').lower()[:24]
    return f"{prefix}_{clean_name}_{h}"

def clean_title(s: str) -> str:
    # Clean and title case nicely
    words = s.strip().split()
    return " ".join(w.capitalize() if not w.isupper() or len(w) <= 3 else w for w in words)

def main():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    now_iso = datetime.utcnow().isoformat()

    # Load area mapping
    cur.execute("SELECT name_en, id FROM area")
    area_map = {row[0].strip().lower(): row[1] for row in cur.fetchall()}
    print(f"Loaded {len(area_map)} areas.")

    # Current stats
    cur.execute("SELECT count(*) FROM transaction_fact")
    total_tx = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM transaction_fact WHERE matched_project_id IS NOT NULL")
    linked_before = cur.fetchone()[0]
    print(f"Starting stats: {linked_before:,} / {total_tx:,} linked ({linked_before/total_tx*100:.2f}%)")

    # -------------------------------------------------------------------------
    # STEP 1: Specific Named / Numbered Off-plan Projects
    # -------------------------------------------------------------------------
    print("\n--- Step 1: Specific Projects (Aryam Tower, Diamond Arch1, Cleopatra Tower) ---")
    specific_projects = [
        {
            "id": "proj_dld_4488",
            "dld_project_number": "4488",
            "dld_project_id": "4488",
            "name_en": "Aryam Tower By Abu Alnaga",
            "area_name_en": "Jabal Ali First",
            "property_type": "apartment",
            "status": "active"
        },
        {
            "id": "proj_dld_153",
            "dld_project_number": "153",
            "dld_project_id": "153",
            "name_en": "Diamond Arch1",
            "area_name_en": "Al Barsha South Fourth",
            "property_type": "apartment",
            "status": "completed"
        },
        {
            "id": "proj_dld_cleopatra_tower",
            "dld_project_number": "cleopatra_tower",
            "dld_project_id": "cleopatra_tower",
            "name_en": "Cleopatra Tower",
            "area_name_en": "Wadi Al Safa 3",
            "property_type": "apartment",
            "status": "completed"
        }
    ]

    for sp in specific_projects:
        area_id = area_map.get(sp["area_name_en"].lower())
        cur.execute("""
            INSERT INTO project (
                id, dld_project_number, dld_project_id, name_en, area_id,
                property_type, status, research_status, first_seen_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'unresearched', ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                dld_project_number = excluded.dld_project_number,
                property_type = excluded.property_type
        """, (
            sp["id"], sp["dld_project_number"], sp["dld_project_id"],
            sp["name_en"], area_id, sp["property_type"], sp["status"],
            now_iso, now_iso
        ))

    # Link transactions for specific projects
    cur.execute("""
        UPDATE transaction_fact
        SET matched_project_id = 'proj_dld_4488', match_confidence = 'confirmed'
        WHERE matched_project_id IS NULL AND (dld_project_id = '4488' OR building_name_en LIKE '%Aryam tower%')
    """)
    cur.execute("""
        UPDATE transaction_fact
        SET matched_project_id = 'proj_dld_153', match_confidence = 'confirmed'
        WHERE matched_project_id IS NULL AND (dld_project_id = '153' OR project_name_en LIKE '%DIAMOND ARCH%')
    """)
    cur.execute("""
        UPDATE transaction_fact
        SET matched_project_id = 'proj_dld_cleopatra_tower', match_confidence = 'confirmed'
        WHERE matched_project_id IS NULL AND building_name_en LIKE '%CLEOPATRA TOWER%'
    """)
    conn.commit()

    cur.execute("SELECT count(*) FROM transaction_fact WHERE matched_project_id IS NOT NULL")
    print(f"After Step 1: {cur.fetchone()[0]:,} / {total_tx:,} linked")

    # -------------------------------------------------------------------------
    # STEP 2: Completed / Existing Buildings (with building_name_en)
    # -------------------------------------------------------------------------
    print("\n--- Step 2: Completed Buildings with building_name_en ---")
    cur.execute("""
        SELECT 
            building_name_en, 
            area_name_en,
            COUNT(*) as tx_cnt,
            SUM(CASE WHEN lower(property_type) = 'villa' OR lower(property_subtype) = 'villa' THEN 1 ELSE 0 END) as villa_cnt
        FROM transaction_fact
        WHERE matched_project_id IS NULL 
          AND building_name_en IS NOT NULL 
          AND trim(building_name_en) != ''
        GROUP BY building_name_en, area_name_en
    """)
    bldg_groups = cur.fetchall()
    print(f"Found {len(bldg_groups)} building groups to process.")

    new_projects = []
    bldg_tx_updates = []

    for bldg_name, area_name, tx_cnt, villa_cnt in bldg_groups:
        proj_id = make_slug_id("proj_bldg", f"{bldg_name}_{area_name}")
        area_id = area_map.get(area_name.strip().lower()) if area_name else None
        prop_type = "villa" if villa_cnt > (tx_cnt / 2) else "apartment"
        name_display = clean_title(bldg_name)

        new_projects.append((
            proj_id, name_display, area_id, prop_type, "completed", "unresearched", now_iso, now_iso
        ))
        bldg_tx_updates.append((proj_id, bldg_name, area_name))

    print(f"Registering {len(new_projects)} buildings into project table...")
    cur.executemany("""
        INSERT INTO project (
            id, name_en, area_id, property_type, status, research_status, first_seen_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            property_type = excluded.property_type,
            updated_at = excluded.updated_at
    """, new_projects)
    conn.commit()

    print(f"Linking transactions to new building projects...")
    for proj_id, bldg_name, area_name in bldg_tx_updates:
        cur.execute("""
            UPDATE transaction_fact
            SET matched_project_id = ?, match_confidence = 'auto'
            WHERE matched_project_id IS NULL 
              AND building_name_en = ? 
              AND area_name_en = ?
        """, (proj_id, bldg_name, area_name))
    conn.commit()

    cur.execute("SELECT count(*) FROM transaction_fact WHERE matched_project_id IS NOT NULL")
    print(f"After Step 2: {cur.fetchone()[0]:,} / {total_tx:,} linked")

    # -------------------------------------------------------------------------
    # STEP 3: Private Villas / Plots without building name
    # -------------------------------------------------------------------------
    print("\n--- Step 3: District Residential / Private Properties (no building_name_en) ---")
    cur.execute("""
        SELECT 
            area_name_en,
            property_type,
            COUNT(*) as tx_cnt
        FROM transaction_fact
        WHERE matched_project_id IS NULL
        GROUP BY area_name_en, property_type
    """)
    area_groups = cur.fetchall()
    print(f"Found {len(area_groups)} area property groups to process.")

    district_projects = []
    district_tx_updates = []

    for area_name, prop_type_raw, tx_cnt in area_groups:
        area_clean = area_name.strip() if area_name else "Dubai"
        type_str = (prop_type_raw or "Residential").strip()
        proj_id = make_slug_id("proj_area", f"{area_clean}_{type_str}")
        area_id = area_map.get(area_clean.lower())

        if "villa" in type_str.lower():
            display_name = f"{area_clean} Residential Villas"
            canon_type = "villa"
        elif "building" in type_str.lower():
            display_name = f"{area_clean} Standalone Buildings"
            canon_type = "apartment"
        else:
            display_name = f"{area_clean} Private Residential"
            canon_type = "apartment"

        district_projects.append((
            proj_id, display_name, area_id, canon_type, "completed", "unresearched", now_iso, now_iso
        ))
        district_tx_updates.append((proj_id, area_name, prop_type_raw))

    print(f"Registering {len(district_projects)} district groups into project table...")
    cur.executemany("""
        INSERT INTO project (
            id, name_en, area_id, property_type, status, research_status, first_seen_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            property_type = excluded.property_type,
            updated_at = excluded.updated_at
    """, district_projects)
    conn.commit()

    print("Linking transactions to district groups...")
    for proj_id, area_name, prop_type_raw in district_tx_updates:
        if prop_type_raw is None:
            cur.execute("""
                UPDATE transaction_fact
                SET matched_project_id = ?, match_confidence = 'auto'
                WHERE matched_project_id IS NULL 
                  AND area_name_en = ? 
                  AND property_type IS NULL
            """, (proj_id, area_name))
        else:
            cur.execute("""
                UPDATE transaction_fact
                SET matched_project_id = ?, match_confidence = 'auto'
                WHERE matched_project_id IS NULL 
                  AND area_name_en = ? 
                  AND property_type = ?
            """, (proj_id, area_name, prop_type_raw))
    conn.commit()

    # -------------------------------------------------------------------------
    # STEP 4: Fallback cleanup if any single row remains
    # -------------------------------------------------------------------------
    cur.execute("SELECT count(*) FROM transaction_fact WHERE matched_project_id IS NULL")
    remaining_unlinked = cur.fetchone()[0]
    print(f"\nRemaining unlinked transactions: {remaining_unlinked}")

    if remaining_unlinked > 0:
        print("Handling any residual rows by area fallback...")
        cur.execute("""
            SELECT DISTINCT area_name_en FROM transaction_fact WHERE matched_project_id IS NULL
        """)
        residual_areas = [r[0] for r in cur.fetchall()]
        for r_area in residual_areas:
            area_clean = r_area.strip() if r_area else "Dubai"
            proj_id = make_slug_id("proj_area", f"{area_clean}_general")
            area_id = area_map.get(area_clean.lower())
            cur.execute("""
                INSERT OR IGNORE INTO project (
                    id, name_en, area_id, property_type, status, research_status, first_seen_at, updated_at
                ) VALUES (?, ?, ?, 'apartment', 'completed', 'unresearched', ?, ?)
            """, (proj_id, f"{area_clean} Properties", area_id, now_iso, now_iso))
            cur.execute("""
                UPDATE transaction_fact
                SET matched_project_id = ?, match_confidence = 'auto'
                WHERE matched_project_id IS NULL AND area_name_en = ?
            """, (proj_id, r_area))
        conn.commit()

    # -------------------------------------------------------------------------
    # INTEGRITY VERIFICATION
    # -------------------------------------------------------------------------
    cur.execute("SELECT count(*) FROM transaction_fact")
    final_total = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM transaction_fact WHERE matched_project_id IS NOT NULL")
    final_linked = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM transaction_fact WHERE matched_project_id IS NULL")
    final_unlinked = cur.fetchone()[0]

    cur.execute("""
        SELECT count(*) FROM transaction_fact
        WHERE matched_project_id NOT IN (SELECT id FROM project)
    """)
    dangling = cur.fetchone()[0]

    pct = (final_linked / final_total) * 100

    print("\n" + "=" * 60)
    print("🏆 FINAL VERIFICATION REPORT")
    print("=" * 60)
    print(f"Total Transactions:      {final_total:,}")
    print(f"Linked Transactions:     {final_linked:,} ({pct:.4f}%)")
    print(f"Unlinked Transactions:   {final_unlinked}")
    print(f"Dangling References:     {dangling}")
    print("=" * 60)

    conn.close()

if __name__ == "__main__":
    main()
