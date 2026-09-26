/**
 * Database client singleton — SQLite via better-sqlite3 + Drizzle ORM
 * Phase 2: Server-side only. Never import this in client components.
 */

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@db/schema";
import path from "path";

const DB_PATH =
  process.env.DATABASE_URL ||
  path.join(process.cwd(), "db", "offplan.db");

// Singleton pattern — reuse connection in Next.js dev hot-reload
const globalForDb = globalThis as unknown as {
  _sqliteDb: ReturnType<typeof Database> | undefined;
};

export const sqlite =
  globalForDb._sqliteDb ??
  new Database(DB_PATH, { verbose: undefined });

if (process.env.NODE_ENV !== "production") {
  globalForDb._sqliteDb = sqlite;
}

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
