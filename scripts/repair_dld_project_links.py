#!/usr/bin/env python3
"""
Reproducible DLD Project Link Repair Tool (Phase 0 Data Contract Remediation - ADR 011)

Safely repairs dangling project foreign keys in rent_contract_fact and transaction_fact
using the verified DLD project_number -> canonical project_id crosswalk and Unicode-safe
name resolution. Ambiguous name candidates are queued for review rather than auto-matched.

Usage:
  python3 scripts/repair_dld_project_links.py --dry-run
  python3 scripts/repair_dld_project_links.py --db-path /path/to/disposable_db.sqlite
"""

import sys
import os
import sqlite3
import json
import re
import argparse
from pathlib import Path
from collections import defaultdict

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = str(ROOT_DIR / "db/offplan.db")
DEFAULT_PROJECTS_JSON = str(ROOT_DIR / "docs/data-contracts/dld_project_crosswalk.json")
FALLBACK_PROJECTS_JSON = str(ROOT_DIR / "DLD PIPELINE/data/all_dld_projects.json")

def normalize_unicode_name(s: str) -> str:
    """Normalize string preserving Unicode letters (including Arabic) and digits."""
    if not s:
        return ""
    # Remove punctuation/symbols, preserve Unicode alphanumeric
    cleaned = re.sub(r'[^\w\s]', ' ', s.lower(), flags=re.UNICODE)
    return " ".join(cleaned.split())

def load_crosswalk(projects_json_path: str):
    """Load project_number -> canonical project_id mapping and Unicode name map from registry."""
    candidate_paths = [projects_json_path, DEFAULT_PROJECTS_JSON, FALLBACK_PROJECTS_JSON]
    target_path = None
    for cp in candidate_paths:
        if os.path.exists(cp):
            target_path = cp
            break

    if not target_path:
        return {}, {}, defaultdict(list)

    with open(target_path, "r", encoding="utf-8") as f:
        projects_raw = json.load(f)

    pnum_to_pid = {}
    pid_to_pid = {}
    name_to_pids = defaultdict(list)

    for p in projects_raw:
        raw_pid = str(p.get("project_id") or "").split(".")[0].strip()
        raw_pnum = str(p.get("project_number") or "").split(".")[0].strip()
        canonical_pk = f"proj_dld_{raw_pid}" if raw_pid else None

        if raw_pid and canonical_pk:
            pid_to_pid[raw_pid] = canonical_pk
            if raw_pnum:
                pnum_to_pid[raw_pnum] = canonical_pk

        for name_field in ["project_name_en", "project_name", "name_en", "name_ar"]:
            val = p.get(name_field)
            if val and raw_pid:
                norm = normalize_unicode_name(val)
                if norm and raw_pid not in name_to_pids[norm]:
                    name_to_pids[norm].append(raw_pid)

    return pnum_to_pid, pid_to_pid, name_to_pids

def repair_database(db_path: str, projects_json_path: str = DEFAULT_PROJECTS_JSON, dry_run: bool = False):
    print(f"🔧 Running Project Link Repair on: {db_path} (dry_run={dry_run})")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Load valid project PKs and project_numbers from DB
    cur.execute("PRAGMA table_info(project)")
    p_cols = {row[1] for row in cur.fetchall()}
    has_pnum_col = "dld_project_number" in p_cols

    if has_pnum_col:
        cur.execute("SELECT id, dld_project_id, name_en, name_ar, dld_project_number FROM project")
    else:
        cur.execute("SELECT id, dld_project_id, name_en, name_ar, NULL FROM project")
    project_rows = cur.fetchall()
    valid_project_pks = {row[0] for row in project_rows}
    print(f"  Loaded {len(valid_project_pks):,} valid projects from database.")

    # Load registry crosswalk
    pnum_to_pid, pid_to_pid, name_to_pids = load_crosswalk(projects_json_path)

    # Augment crosswalk from database project records if missing
    for p_id, p_dld_id, p_name_en, p_name_ar, p_num in project_rows:
        canonical_pk = p_id
        raw_pid = p_dld_id or (p_id.replace("proj_dld_", "") if p_id.startswith("proj_dld_") else None)
        if raw_pid and p_num:
            raw_pnum_str = str(p_num).split(".")[0].strip()
            if raw_pnum_str and raw_pnum_str not in pnum_to_pid:
                pnum_to_pid[raw_pnum_str] = canonical_pk

    print(f"  Loaded crosswalk: {len(pnum_to_pid):,} project_number mappings, {len(name_to_pids):,} name groups.")

    # Detect duplicate name collisions in registry
    duplicate_names = {k: v for k, v in name_to_pids.items() if len(v) > 1}
    print(f"  Detected {len(duplicate_names):,} duplicate normalized names in registry (must not auto-match!).")

    # -------------------------------------------------------------------------
    # 1. Repair Rent Contract Dangling References
    # -------------------------------------------------------------------------
    print("\n📦 1. Auditing & Repairing rent_contract_fact links...")
    cur.execute("SELECT id, matched_project_id, match_confidence FROM rent_contract_fact WHERE matched_project_id IS NOT NULL")
    rent_rows = cur.fetchall()

    rent_dangling = 0
    rent_repaired = 0
    rent_cleared = 0
    rent_updates = []

    for r_id, curr_pk, curr_conf in rent_rows:
        # Confirmed matches must never be overwritten by automatic repair
        if curr_conf == "confirmed":
            continue

        if curr_pk not in valid_project_pks:
            rent_dangling += 1
            # Check if curr_pk was formed as proj_dld_<project_number>
            match = re.match(r"^proj_dld_(\d+)$", curr_pk)
            target_pk = None
            if match:
                raw_num = match.group(1)
                if raw_num in pnum_to_pid and pnum_to_pid[raw_num] in valid_project_pks:
                    target_pk = pnum_to_pid[raw_num]
                elif raw_num in pid_to_pid and pid_to_pid[raw_num] in valid_project_pks:
                    target_pk = pid_to_pid[raw_num]

            if target_pk:
                rent_updates.append((target_pk, "auto", r_id))
                rent_repaired += 1
            else:
                rent_updates.append((None, "unmatched", r_id))
                rent_cleared += 1

    print(f"  Found {rent_dangling:,} dangling rent project links.")
    print(f"  Resolvable via project_number -> project_id crosswalk: {rent_repaired:,}")
    print(f"  Unresolvable (cleared to NULL/unmatched): {rent_cleared:,}")

    if not dry_run and rent_updates:
        cur.executemany("""
            UPDATE rent_contract_fact
            SET matched_project_id = ?, match_confidence = ?
            WHERE id = ?
        """, rent_updates)
        conn.commit()
        print("  ✅ Applied rent contract link repairs.")

    # -------------------------------------------------------------------------
    # 2. Repair Transaction Facts Links
    # -------------------------------------------------------------------------
    print("\n📦 2. Auditing & Repairing transaction_fact links...")
    cur.execute("""
        SELECT id, dld_project_id, project_name_en, matched_project_id, match_confidence
        FROM transaction_fact
    """)
    tx_rows = cur.fetchall()

    tx_dangling = 0
    tx_repaired = 0
    tx_queued = 0
    tx_updates = []
    match_queue_entries = []

    for tx_id, p_num_raw, pname_en, curr_matched, curr_conf in tx_rows:
        # Confirmed matches must never be overwritten by automatic repair
        if curr_conf == "confirmed":
            continue

        clean_num = str(p_num_raw or "").split(".")[0].strip() if p_num_raw else None
        target_pk = None
        confidence = "unmatched"

        if clean_num:
            if clean_num in pnum_to_pid and pnum_to_pid[clean_num] in valid_project_pks:
                target_pk = pnum_to_pid[clean_num]
                confidence = "auto"
            elif clean_num in pid_to_pid and pid_to_pid[clean_num] in valid_project_pks:
                target_pk = pid_to_pid[clean_num]
                confidence = "auto"

        if not target_pk and pname_en:
            norm = normalize_unicode_name(pname_en)
            if norm:
                candidates = name_to_pids.get(norm, [])
                if len(candidates) == 1 and f"proj_dld_{candidates[0]}" in valid_project_pks:
                    # Single candidate by name only -> queue for review, do NOT auto-assign
                    tx_queued += 1
                    match_queue_entries.append((
                        f"mq_{tx_id}",
                        "needs_review",
                        "project",
                        f"proj_dld_{candidates[0]}",
                        "dld",
                        tx_id,
                        pname_en,
                        0.75,
                        "name_only_match",
                    ))
                elif len(candidates) > 1:
                    # Ambiguous duplicate names -> queue for review
                    tx_queued += 1
                    match_queue_entries.append((
                        f"mq_{tx_id}",
                        "needs_review",
                        "project",
                        None,
                        "dld",
                        tx_id,
                        pname_en,
                        0.50,
                        "ambiguous_name_multiple_candidates",
                    ))

        if curr_matched and curr_matched not in valid_project_pks:
            tx_dangling += 1

        if target_pk and target_pk != curr_matched:
            tx_updates.append((target_pk, confidence, tx_id))
            tx_repaired += 1
        elif not target_pk and curr_matched and curr_matched not in valid_project_pks:
            tx_updates.append((None, "unmatched", tx_id))

    print(f"  Found {tx_dangling:,} dangling transaction links.")
    print(f"  Correctable via verified project_number -> project_id: {tx_repaired:,}")
    print(f"  Name-only candidates queued for review: {tx_queued:,}")

    if not dry_run:
        if tx_updates:
            cur.executemany("""
                UPDATE transaction_fact
                SET matched_project_id = ?, match_confidence = ?
                WHERE id = ?
            """, tx_updates)
        if match_queue_entries:
            cur.executemany("""
                INSERT OR IGNORE INTO match_queue (
                    id, status, candidate_type, internal_id, external_source,
                    external_key, external_name, match_score, match_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, match_queue_entries)
        conn.commit()
        print("  ✅ Applied transaction link repairs.")

    # -------------------------------------------------------------------------
    # 3. Final Verification
    # -------------------------------------------------------------------------
    cur.execute("""
        SELECT count(*) FROM rent_contract_fact
        WHERE matched_project_id IS NOT NULL
          AND matched_project_id NOT IN (SELECT id FROM project)
    """)
    final_rent_dangling = cur.fetchone()[0]

    cur.execute("""
        SELECT count(*) FROM transaction_fact
        WHERE matched_project_id IS NOT NULL
          AND matched_project_id NOT IN (SELECT id FROM project)
    """)
    final_tx_dangling = cur.fetchone()[0]

    print("\n🔍 Final Integrity Verification:")
    print(f"  Dangling Rent Links Remaining: {final_rent_dangling}")
    print(f"  Dangling Transaction Links Remaining: {final_tx_dangling}")

    conn.close()
    return {
        "rent_dangling_initial": rent_dangling,
        "rent_repaired": rent_repaired,
        "tx_repaired": tx_repaired,
        "final_rent_dangling": final_rent_dangling,
        "final_tx_dangling": final_tx_dangling,
    }

def main():
    parser = argparse.ArgumentParser(description="Repair DLD project foreign keys")
    parser.add_argument("--db-path", default=DEFAULT_DB_PATH, help="Path to SQLite database")
    parser.add_argument("--projects-json", default=DEFAULT_PROJECTS_JSON, help="Path to dld_project_crosswalk.json or all_dld_projects.json")
    parser.add_argument("--dry-run", action="store_true", help="Inspect and report without mutating")
    parser.add_argument("--apply", action="store_true", help="Explicitly apply changes to database (required to modify production db)")
    args = parser.parse_args()

    is_prod_db = os.path.abspath(args.db_path) == os.path.abspath(DEFAULT_DB_PATH)

    # Production database safety gate: requires --apply explicitly!
    if is_prod_db and not args.apply:
        print("\n🔒 [SAFETY GATE] Modifying production database requires explicit --apply.")
        print("   Running in SAFE DRY-RUN mode. Database will NOT be mutated.\n")
        dry_run = True
    elif args.dry_run:
        dry_run = True
    elif args.apply:
        dry_run = False
    else:
        # Non-default path without explicit --apply or --dry-run
        dry_run = False

    if not dry_run and is_prod_db:
        import time, shutil
        backup_path = f"{args.db_path}_backup_{int(time.time())}.db"
        print(f"📦 Creating safety backup of production database: {backup_path}")
        shutil.copy2(args.db_path, backup_path)

    repair_database(args.db_path, args.projects_json, dry_run=dry_run)

if __name__ == "__main__":
    main()
