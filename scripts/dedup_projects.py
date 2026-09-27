#!/usr/bin/env python3
"""
Deduplicate project table:
- For projects where both an API version (proj_dld_{large_id}) and 
  transaction version (proj_dld_{project_number}) exist:
  -> Merge data into the API version, delete the transaction version
- For projects ONLY in transaction version (number > 4133, new projects):
  -> Keep them, they're the only source

This script is safe to run multiple times (idempotent).
"""
import sys
import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT_DIR / "DLD PIPELINE" / ".venv" / "bin" / "python"
if VENV_PYTHON.exists() and sys.executable != str(VENV_PYTHON):
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON)] + sys.argv)

import sqlite3
import warnings
warnings.filterwarnings("ignore")

SQLITE_PATH = str(ROOT_DIR / "db/offplan.db")


def main():
    db = sqlite3.connect(SQLITE_PATH)
    db.row_factory = sqlite3.Row
    cur = db.cursor()

    print(f"🔍 Analyzing duplicates in project table...")
    total_before = cur.execute("SELECT COUNT(*) FROM project").fetchone()[0]
    print(f"   Total before: {total_before}")

    # Find all projects with duplicate dld_project_number
    dups = cur.execute("""
        SELECT 
            dld_project_number,
            GROUP_CONCAT(id) as all_ids,
            COUNT(*) as cnt
        FROM project 
        WHERE dld_project_number IS NOT NULL
        GROUP BY dld_project_number
        HAVING cnt > 1
    """).fetchall()

    print(f"   Duplicate groups: {len(dups)}")
    
    deleted = 0
    merged = 0

    for dup in dups:
        proj_num = dup[0]
        ids = dup[1].split(",")
        
        # Separate API-sourced (large numeric part >= 45970166) from tx-sourced (small = project number)
        api_ids = []
        tx_ids = []
        for pid in ids:
            suffix = pid.replace("proj_dld_", "").strip()
            try:
                num = int(suffix)
                if num >= 45970166:
                    api_ids.append(pid)
                else:
                    tx_ids.append(pid)
            except ValueError:
                api_ids.append(pid)
        
        if api_ids and tx_ids:
            # Keep the first API-sourced ID, delete the tx-sourced ones
            # But first, merge any data from tx version that API version is missing
            keeper = api_ids[0]
            for tx_id in tx_ids:
                # Re-link any unit_types from tx_id -> keeper
                cur.execute("UPDATE unit_type SET project_id = ? WHERE project_id = ? AND NOT EXISTS (SELECT 1 FROM unit_type WHERE project_id = ? AND bedrooms = (SELECT bedrooms FROM unit_type WHERE id = unit_type.id))", 
                           (keeper, tx_id, keeper))
                # Re-link any transaction_facts from tx_id -> keeper
                cur.execute("UPDATE transaction_fact SET matched_project_id = ? WHERE matched_project_id = ?",
                           (keeper, tx_id))
                # Delete extra unit types that are now orphaned
                cur.execute("DELETE FROM unit_type WHERE project_id = ?", (tx_id,))
                # Delete the duplicate project
                cur.execute("DELETE FROM project WHERE id = ?", (tx_id,))
                deleted += 1
            merged += 1
        elif len(api_ids) > 1:
            # Multiple API versions - keep first, delete rest
            for extra in api_ids[1:]:
                cur.execute("DELETE FROM project WHERE id = ?", (extra,))
                deleted += 1
        elif len(tx_ids) > 1:
            # Multiple tx versions - keep first (smallest number = oldest), delete rest
            for extra in tx_ids[1:]:
                cur.execute("DELETE FROM project WHERE id = ?", (extra,))
                deleted += 1

    db.commit()

    total_after = cur.execute("SELECT COUNT(*) FROM project").fetchone()[0]
    
    print(f"\n✅ Deduplication complete:")
    print(f"   Merged: {merged} groups")
    print(f"   Deleted: {deleted} duplicate entries")
    print(f"   Total before: {total_before}")
    print(f"   Total after: {total_after}")

    # Verify: check remaining duplicates
    remaining_dups = cur.execute("""
        SELECT COUNT(*) FROM (
            SELECT dld_project_number FROM project 
            WHERE dld_project_number IS NOT NULL
            GROUP BY dld_project_number
            HAVING COUNT(*) > 1
        )
    """).fetchone()[0]
    print(f"   Remaining duplicate groups: {remaining_dups}")

    # Show summary by type
    by_type = cur.execute("SELECT property_type, COUNT(*) as c FROM project GROUP BY property_type").fetchall()
    print(f"\n   By property type:")
    for row in by_type:
        print(f"     {row[0]}: {row[1]}")

    # Max project number
    max_num = cur.execute("SELECT MAX(CAST(dld_project_number AS INTEGER)) FROM project").fetchone()[0]
    print(f"   Max dld_project_number: {max_num}")

    db.close()


if __name__ == "__main__":
    main()
