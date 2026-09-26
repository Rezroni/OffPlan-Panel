#!/usr/bin/env node
/**
 * Bootstrap Script — Phase 2
 * 
 * Reads DLD PIPELINE DuckDB data and populates the SQLite catalog.
 * Run ONCE to seed initial data. Safe to re-run (idempotent upserts).
 * 
 * Usage: node --loader ts-node/esm scripts/seed-from-duckdb.ts
 *    or: npx tsx scripts/seed-from-duckdb.ts
 */

import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import {
  ensureDldSourceConnection,
  createIngestionRun,
  completeIngestionRun,
  importDldTransactions,
  importDldRentContracts,
  importDldServiceCharges,
  recordHealthCheck,
} from "../src/server/adapters/dld/dld-adapter";

// --- Paths ---
const DUCKDB_PATH = path.join(
  process.cwd(),
  "DLD PIPELINE",
  "data",
  "dld.duckdb"
);
const SQLITE_PATH =
  process.env.DATABASE_URL || path.join(process.cwd(), "db", "offplan.db");

const DLD_SOURCE_ID = "dld_pipeline_duckdb";

async function main() {
  console.log("🚀 Dubai Off-plan Research Desk — DLD Seed Script");
  console.log("📂 DuckDB source:", DUCKDB_PATH);
  console.log("💾 SQLite target:", SQLITE_PATH);
  console.log("");

  // Check DuckDB file exists
  const fs = await import("fs");
  if (!fs.existsSync(DUCKDB_PATH)) {
    console.error("❌ DuckDB file not found:", DUCKDB_PATH);
    console.error("   Run the DLD Pipeline first to generate data.");
    process.exit(1);
  }

  // Connect to DuckDB (read-only via better-sqlite3 shim isn't available,
  // but we can use child_process to run DuckDB CLI, OR use the duckdb npm package)
  // Since duckdb npm package may not be installed, we'll use a JSON export approach.
  
  // Try to use duckdb npm if available
  let duckConn: { all: (sql: string) => unknown[] } | null = null;
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const duckdb = require("duckdb");
    const duck = new duckdb.Database(DUCKDB_PATH, { access_mode: "READ_ONLY" });
    duckConn = {
      all: (sql: string) => {
        return new Promise((resolve, reject) => {
          duck.all(sql, (err: Error, rows: unknown[]) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
      },
    } as unknown as { all: (sql: string) => unknown[] };
    console.log("✅ DuckDB connected via npm duckdb package");
  } catch {
    console.log("⚠️  duckdb npm package not found, using Python fallback...");
    duckConn = null;
  }

  // Ensure source connection exists in our SQLite
  await ensureDldSourceConnection();

  // Create ingestion run record
  const runId = await createIngestionRun(DLD_SOURCE_ID, {
    mode: "full_seed",
    timestamp: new Date().toISOString(),
    source: DUCKDB_PATH,
  });

  console.log("📋 Ingestion run ID:", runId);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalExcluded = 0;

  try {
    if (duckConn) {
      // ---------------------------------------------------------------
      // 1. Import Transactions
      // ---------------------------------------------------------------
      console.log("\n1️⃣  Importing transactions...");
      
      // Sample query — adjust table name based on what exists in DuckDB
      // Try common table names from DLD PIPELINE
      let txRows: unknown[] = [];
      const txTableNames = [
        "raw_transactions",
        "transactions",
        "dld_transactions",
        "raw_transactions_clean",
      ];
      
      for (const tableName of txTableNames) {
        try {
          txRows = await (duckConn.all as unknown as (sql: string) => Promise<unknown[]>)(
            `SELECT * FROM ${tableName} LIMIT 50000`
          );
          console.log(`   Found ${txRows.length} rows in table: ${tableName}`);
          break;
        } catch {
          // Table doesn't exist, try next
        }
      }

      if (txRows.length > 0) {
        const txResult = await importDldTransactions(
          txRows as Record<string, unknown>[],
          runId
        );
        console.log(`   ✅ Transactions: ${txResult.inserted} inserted, ${txResult.excluded} excluded`);
        totalFetched += txRows.length;
        totalInserted += txResult.inserted;
        totalExcluded += txResult.excluded;
      } else {
        console.log("   ⚠️  No transaction rows found");
      }

      // ---------------------------------------------------------------
      // 2. Import Rent Contracts
      // ---------------------------------------------------------------
      console.log("\n2️⃣  Importing rent contracts...");
      let rentRows: unknown[] = [];
      const rentTableNames = ["raw_rent_contracts", "rent_contracts", "dld_rents"];
      
      for (const tableName of rentTableNames) {
        try {
          rentRows = await (duckConn.all as unknown as (sql: string) => Promise<unknown[]>)(
            `SELECT * FROM ${tableName} LIMIT 150000`
          );
          console.log(`   Found ${rentRows.length} rows in table: ${tableName}`);
          break;
        } catch {
          // Table doesn't exist, try next
        }
      }

      if (rentRows.length > 0) {
        const rentResult = await importDldRentContracts(
          rentRows as Record<string, unknown>[],
          runId
        );
        console.log(`   ✅ Rent contracts: ${rentResult.inserted} inserted, ${rentResult.excluded} excluded`);
        totalFetched += rentRows.length;
        totalInserted += rentResult.inserted;
        totalExcluded += rentResult.excluded;
      }

      // ---------------------------------------------------------------
      // 3. Import Service Charges
      // ---------------------------------------------------------------
      console.log("\n3️⃣  Importing service charges...");
      let scRows: unknown[] = [];
      const scTableNames = ["raw_service_charges", "service_charges", "dld_service_charges"];
      
      for (const tableName of scTableNames) {
        try {
          scRows = await (duckConn.all as unknown as (sql: string) => Promise<unknown[]>)(
            `SELECT * FROM ${tableName} LIMIT 20000`
          );
          console.log(`   Found ${scRows.length} rows in table: ${tableName}`);
          break;
        } catch {
          // Table doesn't exist, try next
        }
      }

      if (scRows.length > 0) {
        const scResult = await importDldServiceCharges(
          scRows as Record<string, unknown>[],
          runId
        );
        console.log(`   ✅ Service charges: ${scResult.inserted} inserted`);
        totalFetched += scRows.length;
        totalInserted += scResult.inserted;
      }

    } else {
      // Python/DuckDB CLI fallback — generate JSON files from DuckDB
      console.log("🐍 Running Python DuckDB export...");
      const { execSync } = await import("child_process");
      
      try {
        execSync(
          `cd "${path.dirname(DUCKDB_PATH)}" && python3 -c "
import duckdb, json
con = duckdb.connect('data/dld.duckdb')
tables = con.execute('SHOW TABLES').fetchall()
print('Tables:', [t[0] for t in tables])
for t in tables:
    name = t[0]
    rows = con.execute(f'SELECT COUNT(*) FROM {name}').fetchone()[0]
    print(f'{name}: {rows} rows')
"`,
          { stdio: "inherit", cwd: process.cwd() }
        );
      } catch (e) {
        console.log("⚠️  Python DuckDB unavailable. Data needs manual export.");
      }
      
      console.log(
        "\n📝 To complete seeding, export DuckDB tables to JSON:\n" +
        "   cd 'DLD PIPELINE'\n" +
        "   python3 -c \"\n" +
        "   import duckdb, json\n" +
        "   con = duckdb.connect('data/dld.duckdb')\n" +
        "   for table in ['raw_transactions', 'raw_rent_contracts', 'raw_service_charges']:\n" +
        "     rows = con.execute(f'SELECT * FROM {table}').df().to_dict(orient='records')\n" +
        "     json.dump(rows, open(f'data/{table}.json', 'w'))\n" +
        "   \""
      );
    }

    // Mark run as complete
    await completeIngestionRun(runId, {
      fetched: totalFetched,
      inserted: totalInserted,
      skipped: totalExcluded,
    });

    // Record data health
    await recordHealthCheck(DLD_SOURCE_ID, {
      totalRecords: totalInserted,
      status: totalInserted > 0 ? "ok" : "missing",
      notes: `Seed from DuckDB: ${totalFetched} fetched, ${totalInserted} inserted, ${totalExcluded} excluded`,
    });

    console.log("\n✅ Seed complete!");
    console.log(`   Total fetched:  ${totalFetched}`);
    console.log(`   Total inserted: ${totalInserted}`);
    console.log(`   Total excluded: ${totalExcluded}`);

  } catch (error) {
    await completeIngestionRun(
      runId,
      { fetched: totalFetched, inserted: totalInserted, skipped: totalExcluded },
      String(error)
    );
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);
