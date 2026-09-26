#!/usr/bin/env python3
"""
Populate Master Developer and Operating Developer across the catalog.
Sets:
- master_developer_name: from DLD official registry (all_dld_projects.json)
- operating_developer_name: detected from project branding and private developer partnerships
- developer_id: linked to operating developer (e.g. H&H Development) with track record support
"""
import sqlite3
import json
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = str(ROOT_DIR / "db/offplan.db")
PROJECTS_JSON = str(ROOT_DIR / "DLD PIPELINE/data/all_dld_projects.json")

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Create H&H Development and other premier private developers in developer table
    premier_devs = [
        ("dev_hh_development", "H&H Development LLC", "H&H Development", "hh_development"),
        ("dev_iman", "Iman Developers LLC", "Iman Developers", "iman_developers"),
        ("dev_ellington", "Ellington Properties Development LLC", "Ellington Properties", "ellington_properties"),
        ("dev_select_group", "Select Group Limited", "Select Group", "select_group"),
        ("dev_ahs", "AHS Properties LLC", "AHS Properties", "ahs_properties"),
        ("dev_omniyat", "Omniyat Properties LLC", "Omniyat", "omniyat"),
    ]

    for dev_id, legal_name, brand_name, dld_id in premier_devs:
        cur.execute("""
            INSERT INTO developer (id, legal_name, brand_name, dld_developer_id)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                legal_name = excluded.legal_name,
                brand_name = excluded.brand_name
        """, (dev_id, legal_name, brand_name, dld_id))

    print("Created premier developer entities in database.")

    # 2. Load DLD projects JSON to get master_developer_name for all 3000+ projects
    with open(PROJECTS_JSON, "r", encoding="utf-8") as f:
        projects_raw = json.load(f)

    master_map = {}
    for p in projects_raw:
        pid = str(p.get("project_id") or "").split(".")[0].strip()
        master_name = p.get("master_developer_name") or p.get("developer_name")
        if pid and master_name:
            # Clean English/Arabic name if available
            master_map[f"proj_dld_{pid}"] = master_name.strip()

    print(f"Loaded master developer names for {len(master_map)} projects.")

    # Update master_developer_name for all projects
    updates = [(name, pk) for pk, name in master_map.items()]
    cur.executemany("""
        UPDATE project
        SET master_developer_name = ?
        WHERE id = ?
    """, updates)
    print(f"Updated master_developer_name across {len(updates)} projects.")

    # 3. Specifically map Operating Developers based on well-established Dubai market branding:
    # A. H&H Development (Eden House series)
    cur.execute("""
        UPDATE project
        SET operating_developer_name = 'H&H Development',
            developer_id = 'dev_hh_development',
            master_developer_name = CASE 
                WHEN id = 'proj_dld_678813961' THEN 'Meraas Properties LLC'
                WHEN id = 'proj_dld_552270820' THEN 'Meydan Group LLC'
                WHEN id = 'proj_dld_653025699' THEN 'Emaar Properties PJSC'
                ELSE COALESCE(master_developer_name, 'Meraas Properties LLC')
            END
        WHERE lower(name_en) LIKE '%eden house%' OR lower(name_en) LIKE '%eden hills%'
    """)
    print("Updated H&H Development projects (Eden House The Park, Eden House The Canal, etc.).")

    # B. Iman Developers (Oxford, One Park Central, etc.)
    cur.execute("""
        UPDATE project
        SET operating_developer_name = 'Iman Developers',
            developer_id = 'dev_iman'
        WHERE lower(name_en) LIKE '%oxford%' OR lower(name_en) LIKE '%one park central%' OR lower(name_en) LIKE '%iman%'
    """)

    # C. Ellington Properties (Belgravia, Wilton, Claydon, Mercer, etc.)
    cur.execute("""
        UPDATE project
        SET operating_developer_name = 'Ellington Properties',
            developer_id = 'dev_ellington'
        WHERE lower(name_en) LIKE '%belgravia%' OR lower(name_en) LIKE '%wilton%' OR lower(name_en) LIKE '%claydon%' OR lower(name_en) LIKE '%ellington%'
    """)

    # D. AHS Properties (One Canal, Casa Canal, etc.)
    cur.execute("""
        UPDATE project
        SET operating_developer_name = 'AHS Properties',
            developer_id = 'dev_ahs',
            master_developer_name = COALESCE(master_developer_name, 'Meraas Properties LLC')
        WHERE lower(name_en) LIKE '%casa canal%' OR lower(name_en) LIKE '%one canal%'
    """)

    conn.commit()

    # Check Eden House The Park
    cur.execute("""
        SELECT p.id, p.name_en, p.operating_developer_name, p.master_developer_name, d.brand_name
        FROM project p
        LEFT JOIN developer d ON p.developer_id = d.id
        WHERE p.id = 'proj_dld_678813961'
    """)
    row = cur.fetchone()
    print("\n✅ Verification for Eden House The Park:")
    print(f"  Project ID: {row[0]}")
    print(f"  Project Name: {row[1]}")
    print(f"  Operating Developer: {row[2]} (Linked Dev: {row[4]})")
    print(f"  Master Developer / Land: {row[3]}")

    conn.close()

if __name__ == "__main__":
    main()
