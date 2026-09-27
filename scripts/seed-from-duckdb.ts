#!/usr/bin/env node
/**
 * Bootstrap Script — Phase 2
 * 
 * Reads DLD PIPELINE DuckDB data and populates the SQLite catalog.
 * Run to seed or update initial data. Safe to re-run (idempotent upserts).
 * 
 * Usage: npx tsx scripts/seed-from-duckdb.ts [--limit <n>] [--batch-size <n>] [--db-path <path>]
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import readline from "readline";
import { spawn } from "child_process";
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
  loadProjectCrosswalk,
  type ImportSummary,
} from "../src/server/adapters/dld/dld-adapter";

// --- CLI Arguments Parsing ---
const args = process.argv.slice(2);
let limitArg: number | undefined = undefined;
let batchSizeArg = 5000;
let customDbPath: string | undefined = undefined;
let customDuckdbPath: string | undefined = undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--limit" && i + 1 < args.length) {
    limitArg = parseInt(args[++i], 10);
  } else if (args[i] === "--batch-size" && i + 1 < args.length) {
    batchSizeArg = parseInt(args[++i], 10);
  } else if (args[i] === "--db-path" && i + 1 < args.length) {
    customDbPath = args[++i];
  } else if (args[i] === "--duckdb-path" && i + 1 < args.length) {
    customDuckdbPath = args[++i];
  }
}

if (limitArg !== undefined && (!Number.isSafeInteger(limitArg) || limitArg < 0)) {
  throw new Error("--limit must be a non-negative integer");
}
if (!Number.isSafeInteger(batchSizeArg) || batchSizeArg <= 0) {
  throw new Error("--batch-size must be a positive integer");
}

// --- Paths ---
const DUCKDB_PATH =
  customDuckdbPath ||
  path.join(process.cwd(), "DLD PIPELINE", "data", "dld.duckdb");
const SQLITE_PATH =
  customDbPath ||
  process.env.DATABASE_URL ||
  path.join(process.cwd(), "db", "offplan.db");

const DLD_SOURCE_ID = "dld_pipeline_duckdb";

function resolvePythonBinary(): string {
  const candidates = [
    process.env.PYTHON_PATH,
    path.join(process.cwd(), "DLD PIPELINE", ".venv312", "bin", "python3"),
    path.join(process.cwd(), "DLD PIPELINE", ".venv", "bin", "python3"),
    path.join(process.cwd(), "DLD PIPELINE", ".venv312", "bin", "python"),
    path.join(process.cwd(), "DLD PIPELINE", ".venv", "bin", "python"),
    "python3",
    "python",
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "python3";
}

interface DuckDbConnection {
  all: (sql: string) => Promise<unknown[]>;
}

interface SourceStreamState {
  table: string | null;
  expectedRows: number | null;
}

export function sanitizeDuckDbValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === "bigint") {
    if (val >= BigInt(Number.MIN_SAFE_INTEGER) && val <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(val);
    }
    return val.toString();
  }
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === "object" && val !== null) {
    if ("days" in val && typeof (val as { days: number }).days === "number") {
      const d = new Date((val as { days: number }).days * 86400000);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    if ("micros" in val && typeof (val as { micros: bigint | number }).micros !== "undefined") {
      const ms = Number(BigInt((val as any).micros) / 1000n);
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
  }
  return val;
}

export function sanitizeDuckDbRow(row: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    sanitized[k] = sanitizeDuckDbValue(v);
  }
  return sanitized;
}

async function* streamDuckDbTable(options: {
  duckConn: DuckDbConnection | null;
  duckdbPath: string;
  candidateTables: string[];
  orderBy: string;
  batchSize: number;
  limit?: number;
  state: SourceStreamState;
}): AsyncGenerator<Record<string, unknown>[]> {
  const { duckConn, duckdbPath, candidateTables, orderBy, batchSize, limit, state } = options;

  if (duckConn) {
    // Locate existing table
    let foundTable: string | null = null;
    for (const table of candidateTables) {
      try {
        await duckConn.all(`SELECT 1 FROM ${table} LIMIT 1`);
        foundTable = table;
        break;
      } catch {
        // try next
      }
    }

    if (!foundTable) {
      throw new Error(`No source table found; tried: ${candidateTables.join(", ")}`);
    }

    console.log(`   📊 Source table found: ${foundTable}`);
    const countRes = (await duckConn.all(
      `SELECT count(*) as cnt FROM ${foundTable}`
    )) as Array<{ cnt: number | bigint }>;
    const totalInTable = Number(countRes[0]?.cnt || 0);
    const targetTotal = limit !== undefined ? Math.min(totalInTable, limit) : totalInTable;
    state.table = foundTable;
    state.expectedRows = targetTotal;
    console.log(`   🎯 Total rows to stream: ${targetTotal} (of ${totalInTable} available, batch size: ${batchSize})`);

    for (let offset = 0; offset < targetTotal; offset += batchSize) {
      const currentBatchLimit = Math.min(batchSize, targetTotal - offset);
      const rows = (await duckConn.all(
        `SELECT * FROM ${foundTable} ORDER BY ${orderBy} LIMIT ${currentBatchLimit} OFFSET ${offset}`
      )) as Record<string, unknown>[];
      if (rows.length > 0) {
        yield rows.map(sanitizeDuckDbRow);
      }
    }
  } else {
    // Stream using Python child process
    const pythonBin = resolvePythonBinary();
    const candidateArg = candidateTables.join(",");
    const limitParam = limit !== undefined ? String(limit) : "none";

    const pyScript = `
import duckdb, json, sys

duckdb_path = sys.argv[1]
candidate_tables = sys.argv[2].split(",")
order_by = sys.argv[3]
limit_arg = sys.argv[4] if len(sys.argv) > 4 else "none"

con = duckdb.connect(duckdb_path, read_only=True)
found_table = None
for t in candidate_tables:
    try:
        con.execute(f"SELECT 1 FROM {t} LIMIT 1")
        found_table = t
        break
    except Exception:
        continue

if not found_table:
    raise RuntimeError(f"No source table found; tried: {candidate_tables}")

cols_info = [c[1] for c in con.execute(f"PRAGMA table_info({found_table})").fetchall()]
order_cols = [c.strip().split()[0] for c in order_by.split(",") if c.strip()]
if not all(col in cols_info for col in order_cols):
    raise RuntimeError(f"Cannot order {found_table} by {order_by}; available columns: {cols_info}")

total_in_table = con.execute(f"SELECT count(*) FROM {found_table}").fetchone()[0]
target_total = min(total_in_table, int(limit_arg)) if limit_arg != "none" else total_in_table
sys.stdout.write(json.dumps({"__offplan_seed_meta__": {"table": found_table, "total": target_total}}) + "\\n")

query = f"SELECT * FROM {found_table}"
query += f" ORDER BY {order_by}"
if limit_arg and limit_arg != "none":
    query += f" LIMIT {int(limit_arg)}"

cur = con.cursor()
cur.execute(query)
cols = [d[0] for d in cur.description]
while True:
    batch = cur.fetchmany(1000)
    if not batch:
        break
    for r in batch:
        sys.stdout.write(json.dumps(dict(zip(cols, r)), default=str) + "\\n")
`;

    const child = spawn(
      pythonBin,
      ["-c", pyScript, duckdbPath, candidateArg, orderBy, limitParam],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let childError: Error | null = null;
    child.once("error", (error) => {
      childError = error;
    });
    const childExit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      child.once("close", (code, signal) => resolve({ code, signal }));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const msg = chunk.toString();
      if (!msg.includes("ExperimentalWarning")) {
        console.error(`[Python DuckDB stderr]: ${msg}`);
      }
    });

    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    let currentBatch: Record<string, unknown>[] = [];
    let receivedMetadata = false;
    for await (const line of rl) {
      if (!line.trim()) continue;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line) as Record<string, unknown>;
      } catch {
        throw new Error("DuckDB streaming runner emitted malformed JSON");
      }

      const metadata = parsed.__offplan_seed_meta__ as { table?: unknown; total?: unknown } | undefined;
      if (metadata) {
        if (
          receivedMetadata ||
          typeof metadata.table !== "string" ||
          typeof metadata.total !== "number" ||
          !Number.isSafeInteger(metadata.total)
        ) {
          throw new Error("DuckDB streaming runner emitted invalid source metadata");
        }
        state.table = metadata.table;
        state.expectedRows = metadata.total;
        receivedMetadata = true;
        continue;
      }

      if (!receivedMetadata) {
        throw new Error("DuckDB streaming runner emitted rows before source metadata");
      }

      currentBatch.push(parsed);
      if (currentBatch.length >= batchSize) {
        yield currentBatch;
        currentBatch = [];
      }
    }

    const exit = await childExit;
    if (childError) throw childError;
    if (exit.code !== 0) {
      throw new Error(`DuckDB streaming runner exited with code ${exit.code}${exit.signal ? ` (${exit.signal})` : ""}`);
    }
    if (!receivedMetadata) {
      throw new Error("DuckDB streaming runner completed without source metadata");
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  }
}

interface IngestionTotals {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  quarantined: number;
  excluded: number;
}

function createEmptyTotals(): IngestionTotals {
  return {
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    quarantined: 0,
    excluded: 0,
  };
}

function accumulateTotals(target: IngestionTotals, summary: ImportSummary) {
  target.fetched += summary.fetched;
  target.inserted += summary.inserted;
  target.updated += summary.updated;
  target.skipped += summary.skipped;
  target.quarantined += summary.quarantined;
  target.excluded += summary.excluded;
}

function assertSourceCountReconciled(
  dataset: string,
  state: SourceStreamState,
  totals: IngestionTotals
) {
  if (state.table === null || state.expectedRows === null) {
    throw new Error(`${dataset} stream did not report its source table and row count`);
  }
  if (totals.fetched !== state.expectedRows) {
    throw new Error(
      `${dataset} source count mismatch for ${state.table}: expected ${state.expectedRows}, processed ${totals.fetched}`
    );
  }
}

async function main() {
  console.log("🚀 Dubai Off-plan Research Desk — DLD Seed Script");
  console.log("📂 DuckDB source:", DUCKDB_PATH);
  console.log("💾 SQLite target:", SQLITE_PATH);
  if (limitArg !== undefined) {
    console.log(`⏱️  Explicit limit per dataset: ${limitArg}`);
  } else {
    console.log("♾️  Streaming all available rows (no silent row limits)");
  }
  console.log(`📦 Batch size: ${batchSizeArg}`);
  console.log("");

  // Check DuckDB file exists
  if (!fs.existsSync(DUCKDB_PATH)) {
    console.error("❌ DuckDB file not found:", DUCKDB_PATH);
    console.error("   Run the DLD Pipeline first to generate data.");
    process.exit(1);
  }

  // Set up SQLite connection
  const sqlite = new Database(SQLITE_PATH);
  sqlite.pragma("foreign_keys = ON");
  const dbClient = drizzle(sqlite, { schema });

  // Connect to DuckDB via native package if available
  let duckConn: DuckDbConnection | null = null;
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
    };
    console.log("✅ DuckDB connected via npm duckdb package");
  } catch {
    console.log("⚠️  duckdb npm package not found, using Python streaming runner...");
    duckConn = null;
  }

  // Ensure source connection exists in SQLite
  await ensureDldSourceConnection(dbClient);

  // Load project crosswalk once for entire ingestion
  console.log("🔍 Loading project crosswalk...");
  const crosswalk = await loadProjectCrosswalk(dbClient);
  console.log(
    `   Crosswalk loaded: ${crosswalk.materializedProjectIds.size} materialized DB projects, ${crosswalk.registryProjectIds.size} static registry IDs`
  );

  // Create ingestion run record
  const runId = await createIngestionRun(
    DLD_SOURCE_ID,
    {
      mode: "full_seed",
      timestamp: new Date().toISOString(),
      source: DUCKDB_PATH,
      limit: limitArg ?? null,
      batchSize: batchSizeArg,
    },
    dbClient
  );

  console.log("📋 Ingestion run ID:", runId);

  const grandTotals = createEmptyTotals();

  try {
    // ---------------------------------------------------------------
    // 1. Import Transactions
    // ---------------------------------------------------------------
    console.log("\n1️⃣  Streaming transactions...");
    const txTotals = createEmptyTotals();
    const txState: SourceStreamState = { table: null, expectedRows: null };
    const txStream = streamDuckDbTable({
      duckConn,
      duckdbPath: DUCKDB_PATH,
      candidateTables: [
        "raw_transactions",
        "transactions",
        "dld_transactions",
        "raw_transactions_clean",
      ],
      orderBy: "transaction_id ASC",
      batchSize: batchSizeArg,
      limit: limitArg,
      state: txState,
    });

    let txBatchIndex = 0;
    for await (const batch of txStream) {
      txBatchIndex++;
      const summary = await importDldTransactions(batch as any[], runId, {
        crosswalk,
        dbClient,
      });
      accumulateTotals(txTotals, summary);
      accumulateTotals(grandTotals, summary);
      console.log(
        `   [Batch ${txBatchIndex}] Transactions: ${summary.fetched} fetched | ` +
        `${summary.inserted} ins, ${summary.updated} upd, ${summary.skipped} skip, ` +
        `${summary.quarantined} quar, ${summary.excluded} excl`
      );
    }
    assertSourceCountReconciled("Transaction", txState, txTotals);
    console.log(
      `   ✅ Transactions complete: ${txTotals.fetched} fetched, ${txTotals.inserted} inserted, ` +
      `${txTotals.updated} updated, ${txTotals.skipped} skipped, ${txTotals.quarantined} quarantined, ` +
      `${txTotals.excluded} excluded`
    );

    // ---------------------------------------------------------------
    // 2. Import Rent Contracts
    // ---------------------------------------------------------------
    console.log("\n2️⃣  Streaming rent contracts...");
    const rentTotals = createEmptyTotals();
    const rentState: SourceStreamState = { table: null, expectedRows: null };
    const rentStream = streamDuckDbTable({
      duckConn,
      duckdbPath: DUCKDB_PATH,
      candidateTables: [
        "raw_rent_contracts",
        "rent_contracts",
        "dld_rents",
      ],
      orderBy: "contract_id ASC, line_number ASC",
      batchSize: batchSizeArg,
      limit: limitArg,
      state: rentState,
    });

    let rentBatchIndex = 0;
    for await (const batch of rentStream) {
      rentBatchIndex++;
      const summary = await importDldRentContracts(batch as any[], runId, {
        crosswalk,
        dbClient,
      });
      accumulateTotals(rentTotals, summary);
      accumulateTotals(grandTotals, summary);
      console.log(
        `   [Batch ${rentBatchIndex}] Rents: ${summary.fetched} fetched | ` +
        `${summary.inserted} ins, ${summary.updated} upd, ${summary.skipped} skip, ` +
        `${summary.quarantined} quar, ${summary.excluded} excl`
      );
    }
    assertSourceCountReconciled("Rent contract", rentState, rentTotals);
    console.log(
      `   ✅ Rent contracts complete: ${rentTotals.fetched} fetched, ${rentTotals.inserted} inserted, ` +
      `${rentTotals.updated} updated, ${rentTotals.skipped} skipped, ${rentTotals.quarantined} quarantined, ` +
      `${rentTotals.excluded} excluded`
    );

    // ---------------------------------------------------------------
    // 3. Import Service Charges
    // ---------------------------------------------------------------
    console.log("\n3️⃣  Streaming service charges...");
    const scTotals = createEmptyTotals();
    const scState: SourceStreamState = { table: null, expectedRows: null };
    const scStream = streamDuckDbTable({
      duckConn,
      duckdbPath: DUCKDB_PATH,
      candidateTables: [
        "raw_service_charges",
        "service_charges",
        "dld_service_charges",
      ],
      orderBy: "budget_year ASC, project_id ASC, property_group_id ASC, master_community_id ASC, usage_id ASC, service_category_id ASC",
      batchSize: batchSizeArg,
      limit: limitArg,
      state: scState,
    });

    let scBatchIndex = 0;
    for await (const batch of scStream) {
      scBatchIndex++;
      const summary = await importDldServiceCharges(batch as any[], runId, {
        crosswalk,
        dbClient,
      });
      accumulateTotals(scTotals, summary);
      accumulateTotals(grandTotals, summary);
      console.log(
        `   [Batch ${scBatchIndex}] Service charges: ${summary.fetched} fetched | ` +
        `${summary.inserted} ins, ${summary.updated} upd, ${summary.skipped} skip, ` +
        `${summary.quarantined} quar, ${summary.excluded} excl`
      );
    }
    assertSourceCountReconciled("Service charge", scState, scTotals);
    console.log(
      `   ✅ Service charges complete: ${scTotals.fetched} fetched, ${scTotals.inserted} inserted, ` +
      `${scTotals.updated} updated, ${scTotals.skipped} skipped, ${scTotals.quarantined} quarantined, ` +
      `${scTotals.excluded} excluded`
    );

    // Reconcile verification
    const isReconciled =
      grandTotals.fetched ===
      grandTotals.inserted + grandTotals.updated + grandTotals.skipped + grandTotals.quarantined;

    if (!isReconciled) {
      throw new Error(
        `Ingestion count reconciliation failed: ${grandTotals.fetched} fetched versus ` +
        `${grandTotals.inserted} inserted + ${grandTotals.updated} updated + ` +
        `${grandTotals.skipped} skipped + ${grandTotals.quarantined} quarantined`
      );
    }

    // Mark run as complete with fully reconciled counts
    await completeIngestionRun(
      runId,
      {
        fetched: grandTotals.fetched,
        inserted: grandTotals.inserted,
        updated: grandTotals.updated,
        skipped: grandTotals.skipped,
        quarantined: grandTotals.quarantined,
      },
      undefined,
      dbClient
    );

    // Record data health
    await recordHealthCheck(
      DLD_SOURCE_ID,
      {
        totalRecords: grandTotals.inserted + grandTotals.updated,
        status: grandTotals.inserted + grandTotals.updated > 0 ? "ok" : "missing",
        notes:
          `Seed from DuckDB: ${grandTotals.fetched} fetched, ` +
          `${grandTotals.inserted} inserted, ${grandTotals.updated} updated, ` +
          `${grandTotals.skipped} skipped, ${grandTotals.quarantined} quarantined, ` +
          `${grandTotals.excluded} excluded (reconciled: ${isReconciled})`,
      },
      dbClient
    );

    console.log("\n🏁 Seed complete!");
    console.log(`   Total fetched:     ${grandTotals.fetched}`);
    console.log(`   Total inserted:    ${grandTotals.inserted}`);
    console.log(`   Total updated:     ${grandTotals.updated}`);
    console.log(`   Total skipped:     ${grandTotals.skipped}`);
    console.log(`   Total quarantined: ${grandTotals.quarantined}`);
    console.log(`   Total excluded:    ${grandTotals.excluded}`);
    console.log(`   Reconciled:        ${isReconciled ? "✅ YES" : "❌ NO"}`);

  } catch (error) {
    await completeIngestionRun(
      runId,
      {
        fetched: grandTotals.fetched,
        inserted: grandTotals.inserted,
        updated: grandTotals.updated,
        skipped: grandTotals.skipped,
        quarantined: grandTotals.quarantined,
      },
      String(error),
      dbClient
    );
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

main().catch(console.error);
