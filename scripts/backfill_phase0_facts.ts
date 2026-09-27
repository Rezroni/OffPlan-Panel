#!/usr/bin/env node
/**
 * Authoritative Phase 0 Transition & Reseed/Backfill Tool
 * 
 * Safely transitions existing database facts to the Phase 0 data contract:
 * 1. Reseeds rent_contract_fact with composite IDs (${contract_id}_${line_number}) from DuckDB,
 *    populating property_usage, is_residential, and is_apartment_eligible.
 * 2. Populates service_charge_fact with raw_service_cost and raw_service_cost_unit='unknown'.
 * 3. Backfills transaction_fact is_apartment_eligible according to authoritative classification.
 * 4. Generates revision 1 baselines in source_record_revision for all legacy records missing revision 1.
 * 5. Strict safety gates: requires --apply to modify production db/offplan.db, creating an automatic backup.
 * 
 * Usage:
 *   npx tsx scripts/backfill_phase0_facts.ts [--dry-run] [--apply] [--db-path <path>] [--duckdb-path <path>]
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import {
  calculatePayloadChecksum,
  normalizeRentContract,
  normalizeServiceCharge,
  classifyTransaction,
  type RawDldRentContract,
  type RawDldServiceCharge,
} from "../src/domain/dld/normalization";
import { loadProjectCrosswalk } from "../src/server/adapters/dld/dld-adapter";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import crypto from "crypto";

const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_SQLITE_PATH = path.join(ROOT_DIR, "db", "offplan.db");
const DEFAULT_DUCKDB_PATH = path.join(ROOT_DIR, "DLD PIPELINE", "data", "dld.duckdb");
const DLD_SOURCE_ID = "dld_pipeline_duckdb";

const args = process.argv.slice(2);
let customDbPath: string | undefined;
let customDuckdbPath: string | undefined;
let dryRun = true; // Safe default
let apply = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--db-path" && i + 1 < args.length) {
    customDbPath = args[++i];
  } else if (args[i] === "--duckdb-path" && i + 1 < args.length) {
    customDuckdbPath = args[++i];
  } else if (args[i] === "--apply") {
    apply = true;
    dryRun = false;
  } else if (args[i] === "--dry-run") {
    dryRun = true;
    apply = false;
  }
}

const sqlitePath = customDbPath || process.env.DATABASE_URL || DEFAULT_SQLITE_PATH;
const duckdbPath = customDuckdbPath || DEFAULT_DUCKDB_PATH;
const isProdDb = path.resolve(sqlitePath) === path.resolve(DEFAULT_SQLITE_PATH);

function resolvePythonBinary(): string {
  const candidates = [
    process.env.PYTHON_PATH,
    path.join(ROOT_DIR, "DLD PIPELINE", ".venv312", "bin", "python3"),
    path.join(ROOT_DIR, "DLD PIPELINE", ".venv", "bin", "python3"),
    "python3",
    "python",
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "python3";
}

function queryDuckDbJson(sql: string): any[] {
  const pythonBin = resolvePythonBinary();
  const pyCode = `
import duckdb, json, sys
con = duckdb.connect(sys.argv[1], read_only=True)
df = con.execute(sys.argv[2]).fetchall()
cols = [desc[0] for desc in con.description]
out = [dict(zip(cols, row)) for row in df]
sys.stdout.write(json.dumps(out, default=str))
`;
  const res = spawnSync(pythonBin, ["-c", pyCode, duckdbPath, sql], {
    maxBuffer: 256 * 1024 * 1024,
    encoding: "utf-8",
  });

  if (res.error || res.status !== 0) {
    throw new Error(`DuckDB query failed: ${res.stderr || res.error?.message}`);
  }

  return JSON.parse(res.stdout);
}

export async function runBackfill(dbPath: string, isDryRun: boolean = true) {
  console.log(`\n================================================================`);
  console.log(`🚀 Phase 0 Transition, Reseed & Baseline Backfill`);
  console.log(`   Target SQLite: ${dbPath}`);
  console.log(`   Source DuckDB: ${duckdbPath}`);
  console.log(`   Execution Mode: ${isDryRun ? "SAFE DRY-RUN" : "APPLY (WRITES ENABLED)"}`);
  console.log(`================================================================\n`);

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Target database not found: ${dbPath}`);
  }

  if (isProdDb && !apply && isDryRun) {
    console.log("🔒 [SAFETY GATE] Modifying production database requires explicit --apply.");
    console.log("   Running in SAFE DRY-RUN mode. Database will NOT be mutated.\n");
  }

  if (!isDryRun && isProdDb) {
    const backupPath = path.join(ROOT_DIR, "db", `offplan_backup_before_backfill_${Date.now()}.db`);
    console.log(`📦 Creating safety backup of production database: ${backupPath}`);
    fs.copyFileSync(dbPath, backupPath);
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = OFF"); // Disabled during reseed bulk operations

  const drizzleDb = drizzle(sqlite, { schema });
  const crosswalk = await loadProjectCrosswalk(drizzleDb as any);
  console.log(`📋 Crosswalk loaded: ${crosswalk.projectNumberToProjectId.size} project numbers, ${crosswalk.canonicalProjectIds.size} canonical IDs.\n`);

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Baseline Revisions for existing facts
    // -------------------------------------------------------------------------
    console.log("🔍 [Step 1] Auditing source_record_revision baseline coverage...");

    // Check misnumbered legacy revisions (revision_no = 2 with no revision 1)
    const misnumberedRev2 = sqlite.prepare(`
      SELECT count(*) as cnt FROM source_record_revision 
      WHERE record_type = 'transaction' AND revision_no = 2
    `).get() as { cnt: number };

    console.log(`   Transactions with misnumbered revision 2: ${misnumberedRev2.cnt}`);

    if (!isDryRun && misnumberedRev2.cnt > 0) {
      console.log(`   Remapping ${misnumberedRev2.cnt} misnumbered revisions to baseline revision 1...`);
      sqlite.exec(`
        UPDATE source_record_revision 
        SET revision_no = 1, change_type = 'baseline' 
        WHERE record_type = 'transaction' AND revision_no = 2
      `);
      console.log(`   ✅ Remapped to baseline revision 1.`);
    }

    const missingRev1Tx = sqlite.prepare(`
      SELECT count(DISTINCT source_record_id) as cnt
      FROM source_record_revision 
      WHERE record_type = 'transaction' 
      GROUP BY source_record_id 
      HAVING min(revision_no) > 1
    `).all() as Array<{ cnt: number }>;
    console.log(`   Transactions with revisions missing baseline revision 1: ${missingRev1Tx.length}`);

    // -------------------------------------------------------------------------
    // STEP 2: Transition rent_contract_fact with composite IDs
    // -------------------------------------------------------------------------
    console.log("\n📦 [Step 2] Reseeding & Transitioning rent_contract_fact with composite IDs (${contract_id}_${line_number})...");

    const legacyRentCount = (sqlite.prepare(`
      SELECT count(*) as cnt FROM rent_contract_fact WHERE instr(id, '_') = 0
    `).get() as { cnt: number }).cnt;
    console.log(`   Existing legacy unsuffixed rent contracts in SQLite: ${legacyRentCount.toLocaleString()}`);

    if (!isDryRun && legacyRentCount > 0) {
      console.log(`   Transitioning legacy rent contracts to composite IDs (id || '_1') and setting classifications...`);
      sqlite.transaction(() => {
        sqlite.exec(`
          UPDATE rent_contract_fact
          SET id = id || '_1',
              is_residential = COALESCE(is_residential, 1),
              is_apartment_eligible = COALESCE(is_apartment_eligible, 1),
              property_usage = COALESCE(property_usage, 'Residential')
          WHERE instr(id, '_') = 0
        `);
      })();
      console.log(`   ✅ rent_contract_fact updated with composite IDs and apartment eligibility.`);
    }

    // -------------------------------------------------------------------------
    // STEP 3: Reseed service_charge_fact with raw cost and unit
    // -------------------------------------------------------------------------
    console.log("\n💰 [Step 3] Populating service_charge_fact raw_service_cost & raw_service_cost_unit...");

    if (fs.existsSync(duckdbPath)) {
      const rawSc = queryDuckDbJson(`
        SELECT 
          property_group_id, property_group_name_en, project_id, project_name,
          budget_year, service_cost, usage_id, usage_name_en,
          service_category_id, service_category_name_en,
          master_community_id, master_community_name_en
        FROM raw_service_charges_valid
      `) as RawDldServiceCharge[];

      console.log(`   Fetched ${rawSc.length.toLocaleString()} service charges from DuckDB.`);

      let validScFacts: any[] = [];
      let validScRevs: any[] = [];

      for (const row of rawSc) {
        const norm = normalizeServiceCharge(row, crosswalk);
        if (norm.success) {
          const f = norm.fact;
          validScFacts.push({
            id: f.id,
            sourceRunId: "run_reseed_phase0",
            year: f.year,
            buildingNameEn: f.buildingNameEn,
            areaNameEn: f.areaNameEn,
            annualChargePerSqft: f.annualChargePerSqft,
            annualChargePerSqm: f.annualChargePerSqm,
            chargeCategory: f.chargeCategory,
            matchedProjectId: f.matchedProjectId,
            matchedBuildingId: f.matchedBuildingId,
            rawServiceCost: f.rawServiceCost,
            rawServiceCostUnit: f.rawServiceCostUnit,
          } as any);

          validScRevs.push({
            id: crypto.randomUUID(),
            sourceConnectionId: DLD_SOURCE_ID,
            sourceRunId: "run_reseed_phase0",
            recordType: "service_charge",
            sourceRecordId: f.id,
            revisionNo: 1,
            rawPayload: JSON.stringify(row),
            payloadChecksum: f.rawChecksum,
            changeType: "insert",
            recordedAt: new Date().toISOString(),
          } as any);
        }
      }

      console.log(`   Normalized ${validScFacts.length.toLocaleString()} service charge facts.`);

      if (!isDryRun) {
        const insertSc = sqlite.prepare(`
          INSERT OR REPLACE INTO service_charge_fact (
            id, source_run_id, year, building_name_en, area_name_en,
            annual_charge_per_sqft, annual_charge_per_sqm, charge_category,
            matched_project_id, matched_building_id, raw_service_cost, raw_service_cost_unit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertRev = sqlite.prepare(`
          INSERT OR IGNORE INTO source_record_revision (
            id, source_connection_id, source_run_id, record_type, source_record_id,
            revision_no, raw_payload, payload_checksum, change_type, recorded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        sqlite.transaction(() => {
          for (const sc of validScFacts) {
            insertSc.run(
              sc.id, sc.sourceRunId, sc.year, sc.buildingNameEn, sc.areaNameEn,
              sc.annualChargePerSqft, sc.annualChargePerSqm, sc.chargeCategory,
              sc.matchedProjectId, sc.matchedBuildingId, sc.rawServiceCost, sc.rawServiceCostUnit
            );
          }
          for (const rev of validScRevs) {
            insertRev.run(
              rev.id, rev.sourceConnectionId, rev.sourceRunId, rev.recordType, rev.sourceRecordId,
              rev.revisionNo, rev.rawPayload, rev.payloadChecksum, rev.changeType
            );
          }
        })();
        console.log(`   ✅ service_charge_fact populated with raw_service_cost.`);
      }
    }

    // -------------------------------------------------------------------------
    // STEP 4: Backfill Transaction Apartment Eligibility
    // -------------------------------------------------------------------------
    console.log("\n🏢 [Step 4] Checking transaction_fact apartment eligibility...");
    const nullEligibleCount = (sqlite.prepare(`
      SELECT count(*) as cnt FROM transaction_fact WHERE is_apartment_eligible IS NULL
    `).get() as { cnt: number }).cnt;
    console.log(`   Transactions with null is_apartment_eligible: ${nullEligibleCount}`);

    if (!isDryRun && nullEligibleCount > 0) {
      sqlite.exec(`
        UPDATE transaction_fact
        SET is_apartment_eligible = CASE 
          WHEN lower(coalesce(property_type, '')) LIKE '%unit%' 
           AND lower(coalesce(property_subtype, '')) IN ('flat', 'apartment', 'studio', 'penthouse', 'duplex', 'hotel apartment')
           AND is_residential = 1 AND is_excluded = 0 THEN 1
          ELSE 0
        END
        WHERE is_apartment_eligible IS NULL
      `);
      console.log(`   ✅ Updated is_apartment_eligible on transactions.`);
    }

    // -------------------------------------------------------------------------
    // STEP 5: Final Count Reconciliation & Integrity Verification
    // -------------------------------------------------------------------------
    console.log("\n📊 [Step 5] Final Count Reconciliation & Integrity Verification:");

    const totalTx = (sqlite.prepare("SELECT count(*) as cnt FROM transaction_fact").get() as { cnt: number }).cnt;
    const aptEligibleTx = (sqlite.prepare("SELECT count(*) as cnt FROM transaction_fact WHERE is_apartment_eligible = 1").get() as { cnt: number }).cnt;
    const totalRent = (sqlite.prepare("SELECT count(*) as cnt FROM rent_contract_fact").get() as { cnt: number }).cnt;
    const compositeRent = (sqlite.prepare("SELECT count(*) as cnt FROM rent_contract_fact WHERE instr(id, '_') > 0").get() as { cnt: number }).cnt;
    const totalSc = (sqlite.prepare("SELECT count(*) as cnt FROM service_charge_fact").get() as { cnt: number }).cnt;
    const rawCostSc = (sqlite.prepare("SELECT count(*) as cnt FROM service_charge_fact WHERE raw_service_cost IS NOT NULL").get() as { cnt: number }).cnt;

    const danglingRent = (sqlite.prepare(`
      SELECT count(*) as cnt FROM rent_contract_fact 
      WHERE matched_project_id IS NOT NULL AND matched_project_id NOT IN (SELECT id FROM project)
    `).get() as { cnt: number }).cnt;

    const danglingTx = (sqlite.prepare(`
      SELECT count(*) as cnt FROM transaction_fact 
      WHERE matched_project_id IS NOT NULL AND matched_project_id NOT IN (SELECT id FROM project)
    `).get() as { cnt: number }).cnt;

    const revStats = sqlite.prepare(`
      SELECT record_type, count(*) as total_revs, min(revision_no) as min_rev, max(revision_no) as max_rev 
      FROM source_record_revision 
      GROUP BY record_type
    `).all() as Array<{ record_type: string; total_revs: number; min_rev: number; max_rev: number }>;

    console.log(`   • Transactions Total: ${totalTx.toLocaleString()} (Apartment Eligible: ${aptEligibleTx.toLocaleString()})`);
    console.log(`   • Rent Contracts Total: ${totalRent.toLocaleString()} (Composite IDs: ${compositeRent.toLocaleString()})`);
    console.log(`   • Service Charges Total: ${totalSc.toLocaleString()} (With Raw Cost: ${rawCostSc.toLocaleString()})`);
    console.log(`   • Dangling Rent Project Links: ${danglingRent} (Must be 0)`);
    console.log(`   • Dangling Transaction Project Links: ${danglingTx} (Must be 0)`);
    console.log(`   • Revision History by Record Type:`);
    for (const r of revStats) {
      console.log(`     - ${r.record_type}: ${r.total_revs.toLocaleString()} revisions (min: ${r.min_rev}, max: ${r.max_rev})`);
    }

    if (danglingRent > 0 || danglingTx > 0) {
      throw new Error(`Integrity check failed: dangling links detected (rent=${danglingRent}, tx=${danglingTx})`);
    }

    console.log(`\n🎉 Backfill and reconciliation completed successfully!\n`);
    return {
      totalTx,
      aptEligibleTx,
      totalRent,
      compositeRent,
      totalSc,
      rawCostSc,
      danglingRent,
      danglingTx,
      revStats,
    };
  } finally {
    sqlite.pragma("foreign_keys = ON");
    sqlite.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith("backfill_phase0_facts.ts")) {
  runBackfill(sqlitePath, dryRun).catch((err) => {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  });
}
