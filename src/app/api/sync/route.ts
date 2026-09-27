/**
 * /api/sync — DLD Data Synchronization API
 *
 * POST: Triggers a full DLD pipeline sync:
 *   1. Fetch fresh transactions & rent contracts from Dubai Open Data API
 *   2. Load raw JSON into DuckDB
 *   3. Seed DuckDB → SQLite (via seed-from-duckdb.ts adapter)
 *
 * GET: Returns current sync status (freshness check without triggering sync)
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { sqlite } from "@/server/db";

// ---------------------------------------------------------------------------
// Singleton lock — prevents concurrent syncs in the same Next.js process
// ---------------------------------------------------------------------------

let syncInProgress = false;
let lastSyncResult: SyncResult | null = null;

interface SyncResult {
  status: "success" | "error" | "running";
  startedAt: string;
  completedAt?: string;
  steps: StepResult[];
  error?: string;
}

interface StepResult {
  name: string;
  status: "success" | "error" | "skipped";
  output?: string;
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// GET — Data freshness check (no sync triggered)
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const freshness = getFreshnessInfo();
    return NextResponse.json({
      syncInProgress,
      lastSync: lastSyncResult,
      freshness,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check data freshness" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Trigger a full sync
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (syncInProgress) {
    return NextResponse.json(
      {
        error: "Sync already in progress",
        status: "running",
        lastSync: lastSyncResult,
      },
      { status: 409 }
    );
  }

  syncInProgress = true;
  const result: SyncResult = {
    status: "running",
    startedAt: new Date().toISOString(),
    steps: [],
  };
  lastSyncResult = result;

  try {
    // Parse optional body params
    let months = 1;
    let reopenDays = 7;
    try {
      const body = await req.json();
      if (body.months) months = Math.min(Math.max(1, Number(body.months)), 24);
      if (body.reopenDays) reopenDays = Math.min(Math.max(1, Number(body.reopenDays)), 30);
    } catch {
      // No body or invalid JSON — use defaults
    }

    const pipelineDir = path.join(process.cwd(), "DLD PIPELINE");
    const pythonBin = resolvePythonBin(pipelineDir);

    // Step 1: Fetch transactions from DLD API (off-plan sales focus)
    const txFetch = await runCommand(
      pythonBin,
      ["-m", "dld", "fetch", "--citywide", "--months", String(months), "--dataset", "dld_transactions-open-api", "--reopen-days", String(reopenDays)],
      pipelineDir,
      "Fetch Transactions"
    );
    result.steps.push(txFetch);

    // Step 2: Load transactions into DuckDB
    const txLoad = await runCommand(
      pythonBin,
      ["-m", "dld", "load", "--dataset", "dld_transactions-open-api"],
      pipelineDir,
      "Load Transactions to DuckDB"
    );
    result.steps.push(txLoad);

    // Step 3: Seed DuckDB → SQLite (authoritative TypeScript adapter)
    const seedResult = await runCommand(
      "npx",
      ["tsx", "scripts/seed-from-duckdb.ts"],
      process.cwd(),
      "Seed DuckDB → SQLite"
    );
    result.steps.push(seedResult);

    // Check for step failures
    const hasErrors = result.steps.some((s) => s.status === "error");
    result.status = hasErrors ? "error" : "success";
    result.completedAt = new Date().toISOString();

    if (hasErrors) {
      result.error = result.steps
        .filter((s) => s.status === "error")
        .map((s) => `${s.name}: ${s.output?.slice(-200)}`)
        .join("; ");
    }

    // Get fresh counts
    const freshness = getFreshnessInfo();

    return NextResponse.json({
      ...result,
      freshness,
    });
  } catch (error) {
    result.status = "error";
    result.completedAt = new Date().toISOString();
    result.error = error instanceof Error ? error.message : String(error);

    return NextResponse.json(result, { status: 500 });
  } finally {
    syncInProgress = false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFreshnessInfo() {
  try {
    const txInfo = sqlite
      .prepare(
        `SELECT
          MAX(transaction_date) as latestDate,
          COUNT(*) as totalCount,
          SUM(CASE WHEN is_excluded = 0 THEN 1 ELSE 0 END) as validCount
        FROM transaction_fact`
      )
      .get() as { latestDate: string | null; totalCount: number; validCount: number } | undefined;

    const rentInfo = sqlite
      .prepare(
        `SELECT
          MAX(contract_date) as latestDate,
          COUNT(*) as totalCount,
          SUM(CASE WHEN is_excluded = 0 THEN 1 ELSE 0 END) as validCount
        FROM rent_contract_fact`
      )
      .get() as { latestDate: string | null; totalCount: number; validCount: number } | undefined;

    const lastRun = sqlite
      .prepare(
        `SELECT id, status, started_at, completed_at, records_inserted, records_updated
         FROM ingestion_run
         ORDER BY started_at DESC
         LIMIT 1`
      )
      .get() as {
        id: string;
        status: string;
        started_at: string;
        completed_at: string | null;
        records_inserted: number | null;
        records_updated: number | null;
      } | undefined;

    return {
      transactions: {
        latestDate: txInfo?.latestDate ?? null,
        totalCount: txInfo?.totalCount ?? 0,
        validCount: txInfo?.validCount ?? 0,
      },
      rentContracts: {
        latestDate: rentInfo?.latestDate ?? null,
        totalCount: rentInfo?.totalCount ?? 0,
        validCount: rentInfo?.validCount ?? 0,
      },
      lastIngestionRun: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status,
            startedAt: lastRun.started_at,
            completedAt: lastRun.completed_at,
            recordsInserted: lastRun.records_inserted,
            recordsUpdated: lastRun.records_updated,
          }
        : null,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function resolvePythonBin(pipelineDir: string): string {
  const candidates = [
    path.join(pipelineDir, ".venv312", "bin", "python3"),
    path.join(pipelineDir, ".venv", "bin", "python3"),
    path.join(pipelineDir, ".venv312", "bin", "python"),
    path.join(pipelineDir, ".venv", "bin", "python"),
  ];

  const fs = require("fs");
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "python3";
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  stepName: string
): Promise<StepResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = "";
    let stderr = "";

    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      const duration = Date.now() - start;
      if (code === 0) {
        resolve({
          name: stepName,
          status: "success",
          output: stdout.slice(-500),
          durationMs: duration,
        });
      } else {
        resolve({
          name: stepName,
          status: "error",
          output: (stderr || stdout).slice(-500),
          durationMs: duration,
        });
      }
    });

    child.on("error", (error) => {
      resolve({
        name: stepName,
        status: "error",
        output: error.message,
        durationMs: Date.now() - start,
      });
    });
  });
}
