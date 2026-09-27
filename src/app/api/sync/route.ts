/**
 * /api/sync — DLD Data Synchronization API
 *
 * Runs full DLD pipeline sync asynchronously in the background:
 *   1. Fetch fresh transactions & rent contracts from Dubai Open Data API
 *   2. Load raw JSON batches into DuckDB columnar storage
 *   3. Seed DuckDB → SQLite (via seed-from-duckdb.ts adapter)
 *
 * GET: Returns current sync status, active background job, and data freshness
 * POST: Triggers a full background sync. Returns immediately so browser does not hang.
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { sqlite } from "@/server/db";

// ---------------------------------------------------------------------------
// Types & Singleton State
// ---------------------------------------------------------------------------

export interface PipelineStep {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "success" | "error";
  durationMs?: number;
  output?: string;
}

export interface SyncJobState {
  id: string;
  status: "running" | "success" | "error" | "idle";
  startedAt: string;
  completedAt?: string;
  canCloseTab: boolean;
  currentStepIndex: number;
  totalSteps: number;
  currentStepTitle: string;
  userGuidance: {
    canClose: boolean;
    headlineRu: string;
    headlineEn: string;
    detailsRu: string;
    detailsEn: string;
  };
  steps: PipelineStep[];
  error?: string;
}

let syncInProgress = false;
let activeSyncJob: SyncJobState | null = null;
let lastSyncJob: SyncJobState | null = null;

// ---------------------------------------------------------------------------
// GET — Status & Freshness Check
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const freshness = getFreshnessInfo();

    return NextResponse.json({
      syncInProgress,
      canCloseTab: true,
      activeJob: activeSyncJob,
      lastSync: lastSyncJob,
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
// POST — Trigger Background Sync (Non-blocking)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (syncInProgress && activeSyncJob) {
    return NextResponse.json({
      success: true,
      status: "running",
      syncInProgress: true,
      canCloseTab: true,
      activeJob: activeSyncJob,
      message: "Sync is already in progress in the background. You can safely close this tab or leave the page.",
    });
  }

  // Parse optional params
  let months = 1;
  let reopenDays = 7;
  try {
    const body = await req.json();
    if (body.months) months = Math.min(Math.max(1, Number(body.months)), 24);
    if (body.reopenDays) reopenDays = Math.min(Math.max(1, Number(body.reopenDays)), 30);
  } catch {
    // defaults
  }

  const jobId = `run_${Date.now()}`;
  syncInProgress = true;

  activeSyncJob = {
    id: jobId,
    status: "running",
    startedAt: new Date().toISOString(),
    canCloseTab: true,
    currentStepIndex: 0,
    totalSteps: 3,
    currentStepTitle: "1/3: Загрузка через Dubai Open Data API (DLD Fetch)...",
    userGuidance: {
      canClose: true,
      headlineRu: "Фоновая синхронизация запущена на сервере",
      headlineEn: "Background synchronization is running on server",
      detailsRu: "Вы можете спокойно закрыть эту вкладку или перейти в другие разделы приложения. Процесс выполняется на сервере и не прервётся.",
      detailsEn: "You can safely close this tab or navigate to other pages. The job executes independently in the background on the server.",
    },
    steps: [
      {
        id: "step_fetch",
        name: "DLD Open Data API Fetch",
        description: "Загрузка транзакций купли-продажи и договоров аренды (Dubai Pulse API)",
        status: "running",
      },
      {
        id: "step_duckdb",
        name: "DuckDB Analytical Staging",
        description: "Колоночный паркет, дедупликация и индексация в DuckDB хранилище",
        status: "pending",
      },
      {
        id: "step_sqlite",
        name: "SQLite Catalog Synchronization",
        description: "Гармонизация связей, расчёт Oqood цен и обновление каталога",
        status: "pending",
      },
    ],
  };

  // Launch background execution asynchronously
  runPipelineInBackground(months, reopenDays).catch((err) => {
    console.error("Unhandled pipeline error:", err);
  });

  // Return immediately so the HTTP request completes instantly
  return NextResponse.json({
    success: true,
    status: "running",
    syncInProgress: true,
    canCloseTab: true,
    activeJob: activeSyncJob,
    message: "Background synchronization started. You can safely close or leave this page.",
  });
}

// ---------------------------------------------------------------------------
// Background Worker
// ---------------------------------------------------------------------------

async function runPipelineInBackground(months: number, reopenDays: number) {
  if (!activeSyncJob) return;

  const pipelineDir = path.join(process.cwd(), "DLD PIPELINE");
  const pythonBin = resolvePythonBin(pipelineDir);

  try {
    // -------------------------------------------------------------------------
    // Step 1: DLD API Fetch
    // -------------------------------------------------------------------------
    activeSyncJob.currentStepIndex = 0;
    activeSyncJob.steps[0].status = "running";
    activeSyncJob.currentStepTitle = "1/3: Загрузка через Dubai Open Data API (DLD Fetch)...";

    const txFetch = await runCommand(
      pythonBin,
      [
        "-m", "dld", "fetch",
        "--citywide",
        "--months", String(months),
        "--dataset", "dld_transactions-open-api",
        "--reopen-days", String(reopenDays),
      ],
      pipelineDir,
      "Fetch Transactions"
    );

    activeSyncJob.steps[0].status = txFetch.status;
    activeSyncJob.steps[0].durationMs = txFetch.durationMs;
    activeSyncJob.steps[0].output = txFetch.output;

    // -------------------------------------------------------------------------
    // Step 2: Load to DuckDB
    // -------------------------------------------------------------------------
    activeSyncJob.currentStepIndex = 1;
    activeSyncJob.steps[1].status = "running";
    activeSyncJob.currentStepTitle = "2/3: Стейджинг в колоночное хранилище DuckDB...";

    const txLoad = await runCommand(
      pythonBin,
      ["-m", "dld", "load", "--dataset", "dld_transactions-open-api"],
      pipelineDir,
      "Load Transactions to DuckDB"
    );

    activeSyncJob.steps[1].status = txLoad.status;
    activeSyncJob.steps[1].durationMs = txLoad.durationMs;
    activeSyncJob.steps[1].output = txLoad.output;

    // -------------------------------------------------------------------------
    // Step 3: Seed to SQLite
    // -------------------------------------------------------------------------
    activeSyncJob.currentStepIndex = 2;
    activeSyncJob.steps[2].status = "running";
    activeSyncJob.currentStepTitle = "3/3: Синхронизация SQLite моделей и обновление каталога...";

    const seedResult = await runCommand(
      "npx",
      ["tsx", "scripts/seed-from-duckdb.ts", "--batch-size", "5000"],
      process.cwd(),
      "Seed DuckDB → SQLite"
    );

    activeSyncJob.steps[2].status = seedResult.status;
    activeSyncJob.steps[2].durationMs = seedResult.durationMs;
    activeSyncJob.steps[2].output = seedResult.output;

    // Finalize
    const hasErrors = activeSyncJob.steps.some((s) => s.status === "error");
    activeSyncJob.status = hasErrors ? "error" : "success";
    activeSyncJob.completedAt = new Date().toISOString();
    activeSyncJob.currentStepTitle = hasErrors
      ? "Синхронизация завершилась с замечаниями"
      : "Синхронизация успешно завершена!";

    lastSyncJob = { ...activeSyncJob };
  } catch (err) {
    if (activeSyncJob) {
      activeSyncJob.status = "error";
      activeSyncJob.completedAt = new Date().toISOString();
      activeSyncJob.error = err instanceof Error ? err.message : String(err);
      lastSyncJob = { ...activeSyncJob };
    }
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

    // Get last completed run
    const lastRun = sqlite
      .prepare(
        `SELECT id, status, started_at, completed_at, records_inserted, records_updated
         FROM ingestion_run
         WHERE status IN ('done', 'completed') OR (status = 'running' AND started_at > datetime('now', '-15 minutes'))
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
): Promise<{ name: string; status: "success" | "error"; output?: string; durationMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = "";
    let stderr = "";

    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk: Buffer) => {
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
