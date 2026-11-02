import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

// Reused across hot reloads in dev so each edit doesn't open a new pool.
const globalForDb = globalThis as typeof globalThis & { db?: Database };

/**
 * Connects as the table owner, which RLS doesn't restrict: every query must be
 * scoped to the signed-in user by the caller.
 */
export function getDb(): Database {
  if (globalForDb.db) return globalForDb.db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  globalForDb.db = drizzle(postgres(url, { max: 5 }), { schema });
  return globalForDb.db;
}
