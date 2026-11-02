import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't read env files; mirror Next's precedence
// (real environment > .env.local > .env).
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) {
    process.env[key] ??= value;
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  // Supabase owns the auth/storage schemas; only ever manage public.
  schemaFilter: ["public"],
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
