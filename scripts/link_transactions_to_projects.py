#!/usr/bin/env python3
"""
System-wide Transaction to Project Linker
Links all transactions in transaction_fact to their canonical project.id in the project table
using DLD project_number -> project_id mappings and exact name normalization.
"""
import sqlite3
import json
import os
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = str(ROOT_DIR / "db/offplan.db")
PROJECTS_JSON = str(ROOT_DIR / "DLD PIPELINE/data/all_dld_projects.json")

def normalize_name(s: str) -> str:
    if not s:
        return ""
    # Remove special chars and extra spaces
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', s.lower())
    return " ".join(cleaned.split())

# ==============================================================================
# RETIRED / DEPRECATED SCRIPT (Phase 0 Data Contract Remediation - ADR 011, P0-04)
# ==============================================================================
# This script has been retired because:
# 1. P0-04: Line 21 stripped all non-ASCII letters, wiping out Arabic Unicode
#    and collapsing project names to lone numbers (e.g. "5" colliding 30 projects).
# 2. Lines 51 and 59 overwrote duplicate dictionary keys, silently resolving
#    ambiguous identities and assigning false project links.
#
# SAFE REPLACEMENT:
# Use scripts/repair_dld_project_links.py which preserves Unicode, detects
# duplicates, queues ambiguous matches into match_queue, and never forces unsafe links.
# ==============================================================================

def main():
    if "--force-unsafe-legacy-run" not in sys.argv:
        print("❌ ERROR: scripts/link_transactions_to_projects.py is RETIRED under ADR 011 (P0-04).")
        print("   This script performs unsafe ASCII-only regex normalization and false auto-matching.")
        print("   -> To repair links safely, use: python3 scripts/repair_dld_project_links.py")
        print("   -> To override this safety gate: pass --force-unsafe-legacy-run")
        sys.exit(1)

    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Load project registry mapping
    print(f"Loading DLD projects dictionary from: {PROJECTS_JSON}")
    with open(PROJECTS_JSON, "r", encoding="utf-8") as f:
        projects_raw = json.load(f)

    # Build bidirectional lookup maps
    # project_number -> project.id (e.g. "3382" -> "proj_dld_678813961")
    num_to_pid = {}
    pid_to_pid = {}
    name_to_pid = {}

    for p in projects_raw:
        pid = str(p.get("project_id") or "").split(".")[0].strip()
        pnum = str(p.get("project_number") or "").split(".")[0].strip()
        pname_en = p.get("project_name_en") or p.get("project_name") or ""
        canonical_pk = f"proj_dld_{pid}"

        if pid:
            pid_to_pid[pid] = canonical_pk
        if pnum and pid:
            num_to_pid[pnum] = canonical_pk
        if pname_en and pid:
            name_to_pid[normalize_name(pname_en)] = canonical_pk

    print(f"Loaded {len(num_to_pid)} project number mappings and {len(name_to_pid)} project name mappings.")

    # Also load existing project IDs from SQLite project table to guarantee FK validity
    cur.execute("SELECT id, dld_project_id, name_en FROM project")
    existing_projects = cur.fetchall()
    valid_pks = {row[0] for row in existing_projects}
    sqlite_name_to_pk = {normalize_name(row[2]): row[0] for row in existing_projects if row[2]}
    print(f"Found {len(valid_pks)} existing projects in SQLite project table.")

    # 2. Iterate transactions and update matched_project_id in bulk
    print("Fetching transactions to link...")
    cur.execute("""
        SELECT id, dld_project_id, project_name_en, matched_project_id
        FROM transaction_fact
    """)
    tx_rows = cur.fetchall()
    total_tx = len(tx_rows)
    print(f"Total transactions in database: {total_tx}")

    updates = []
    already_matched = 0
    newly_matched = 0

    for tx_id, dld_pid, pname_en, curr_matched in tx_rows:
        target_pk = None

        # Check by project_number
        clean_num = str(dld_pid or "").split(".")[0].strip()
        if clean_num:
            if clean_num in num_to_pid and num_to_pid[clean_num] in valid_pks:
                target_pk = num_to_pid[clean_num]
            elif clean_num in pid_to_pid and pid_to_pid[clean_num] in valid_pks:
                target_pk = pid_to_pid[clean_num]
            elif f"proj_dld_{clean_num}" in valid_pks:
                target_pk = f"proj_dld_{clean_num}"

        # If still not found, check by normalized project name
        if not target_pk and pname_en:
            norm_name = normalize_name(pname_en)
            if norm_name in sqlite_name_to_pk:
                target_pk = sqlite_name_to_pk[norm_name]
            elif norm_name in name_to_pid and name_to_pid[norm_name] in valid_pks:
                target_pk = name_to_pid[norm_name]

        if target_pk:
            if curr_matched == target_pk:
                already_matched += 1
            else:
                updates.append((target_pk, tx_id))
                newly_matched += 1

    print(f"Transactions already matched correctly: {already_matched}")
    print(f"Transactions to update with new valid project link: {len(updates)}")

    if updates:
        print("Executing bulk update...")
        cur.executemany("""
            UPDATE transaction_fact
            SET matched_project_id = ?
            WHERE id = ?
        """, updates)
        conn.commit()
        print(f"Successfully updated {len(updates)} transactions!")

    # 3. Final verification stats
    cur.execute("""
        SELECT count(*) 
        FROM transaction_fact t 
        JOIN project p ON t.matched_project_id = p.id
    """)
    active_matched = cur.fetchone()[0]
    print(f"\n✅ Total transactions now successfully joined with projects: {active_matched} ({active_matched/total_tx*100:.1f}%)")

    # Check Eden House The Park specifically
    cur.execute("""
        SELECT count(*) FROM transaction_fact
        WHERE matched_project_id = 'proj_dld_678813961'
    """)
    eden_count = cur.fetchone()[0]
    print(f"✅ Eden House The Park (proj_dld_678813961) linked transactions: {eden_count}")

    conn.close()

if __name__ == "__main__":
    main()
