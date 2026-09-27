#!/usr/bin/env node
/**
 * Safe, Idempotent Database Migrator for SQLite / Drizzle
 * 
 * Guarantees:
 * - Safely handles pre-existing columns without crashing on SQLite "duplicate column name".
 * - Inspects PRAGMA table_info before applying ALTER TABLE ADD COLUMN.
 * - Idempotently applies CREATE TABLE / CREATE INDEX.
 * - Reconciles and registers applied migrations in __drizzle_migrations so Drizzle Kit stays in sync.
 * 
 * Usage:
 *   npx tsx scripts/migrate.ts [--db-path <path>] [--dry-run]
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

const args = process.argv.slice(2);
let customDbPath: string | undefined;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--db-path" && i + 1 < args.length) {
    customDbPath = args[++i];
  } else if (args[i] === "--dry-run") {
    dryRun = true;
  }
}

const dbPath = customDbPath || process.env.DATABASE_URL || path.join(process.cwd(), "db", "offplan.db");
const migrationsDir = path.join(process.cwd(), "db", "migrations");
const journalPath = path.join(migrationsDir, "meta", "_journal.json");

export function runSafeMigrations(targetDbPath: string, isDryRun: boolean = false) {
  console.log(`🚀 [Migrator] Connecting to database: ${targetDbPath} (dryRun=${isDryRun})`);
  
  if (!fs.existsSync(journalPath)) {
    throw new Error(`Migration journal not found at ${journalPath}`);
  }

  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
  const sqlite = new Database(targetDbPath);
  sqlite.pragma("foreign_keys = OFF"); // Temporarily off during schema alterations

  try {
    // 1. Ensure __drizzle_migrations table exists
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash text NOT NULL,
        created_at numeric
      );
    `);

    // 2. Fetch applied migration timestamps
    const appliedRows = sqlite.prepare(`SELECT created_at FROM "__drizzle_migrations"`).all() as Array<{ created_at: number }>;
    const appliedTimestamps = new Set(appliedRows.map((r) => Number(r.created_at)));

    let appliedCount = 0;

    for (const entry of journal.entries) {
      if (appliedTimestamps.has(entry.when)) {
        console.log(`   ⏩ Migration [${entry.idx}] ${entry.tag} already recorded as applied.`);
        continue;
      }

      const sqlFilePath = path.join(migrationsDir, `${entry.tag}.sql`);
      if (!fs.existsSync(sqlFilePath)) {
        throw new Error(`Migration SQL file not found: ${sqlFilePath}`);
      }

      console.log(`\n📦 Applying Migration [${entry.idx}] ${entry.tag}...`);
      const rawSql = fs.readFileSync(sqlFilePath, "utf-8");
      const statements = rawSql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const executedStatements: string[] = [];

      for (const stmt of statements) {
        // Check for ALTER TABLE <table> ADD [COLUMN] <col>
        const alterMatch = stmt.match(/ALTER\s+TABLE\s+[`"']?(\w+)[`"']?\s+ADD(?:\s+COLUMN)?\s+[`"']?(\w+)[`"']?/i);
        if (alterMatch) {
          const tableName = alterMatch[1];
          const colName = alterMatch[2];

          // Check if table exists
          const tableExists = sqlite
            .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
            .get(tableName);

          if (tableExists) {
            // Check if column already exists
            const columns = sqlite.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{ name: string }>;
            const colExists = columns.some((c) => c.name.toLowerCase() === colName.toLowerCase());

            if (colExists) {
              console.log(`      ℹ️ Column "${colName}" already exists on table "${tableName}", safely skipping ALTER.`);
              continue;
            }
          }
        }

        // For CREATE TABLE, ensure IF NOT EXISTS
        let safeStmt = stmt;
        if (/^CREATE\s+TABLE\s+/i.test(safeStmt) && !/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i.test(safeStmt)) {
          safeStmt = safeStmt.replace(/^CREATE\s+TABLE\s+/i, "CREATE TABLE IF NOT EXISTS ");
        }

        // For CREATE INDEX, ensure IF NOT EXISTS
        if (/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+/i.test(safeStmt) && !/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS/i.test(safeStmt)) {
          safeStmt = safeStmt.replace(/^CREATE\s+(UNIQUE\s+)?INDEX\s+/i, "CREATE $1INDEX IF NOT EXISTS ");
        }

        if (!isDryRun) {
          try {
            sqlite.exec(safeStmt);
            executedStatements.push(safeStmt);
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg.includes("duplicate column name") || errMsg.includes("already exists")) {
              console.log(`      ℹ️ Object already exists (${errMsg}), safely continuing.`);
            } else {
              throw new Error(`Failed to execute statement in ${entry.tag}: ${errMsg}\nStatement: ${safeStmt}`);
            }
          }
        } else {
          executedStatements.push(safeStmt);
        }
      }

      if (!isDryRun) {
        sqlite
          .prepare(`INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)`)
          .run(entry.tag, entry.when);
        console.log(`   ✅ Migration [${entry.idx}] ${entry.tag} applied and recorded in __drizzle_migrations.`);
      } else {
        console.log(`   🔍 [Dry Run] Migration [${entry.idx}] ${entry.tag} would execute ${executedStatements.length} statements.`);
      }

      appliedCount++;
    }

    console.log(`\n🎉 Migrations complete. Total newly applied: ${appliedCount}`);
    return { appliedCount };
  } finally {
    sqlite.pragma("foreign_keys = ON");
    sqlite.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  runSafeMigrations(dbPath, dryRun);
}
