import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import type { Analysis } from "@/lib/ai/schemas/analysis";
import type { Job } from "@/lib/ai/schemas/job";
import type { Resume } from "@/lib/ai/schemas/resume";
import type { AtsResult } from "@/lib/ats/score";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// Every table enables RLS with no policies: Supabase exposes the public schema through
// its Data API, and this denies that path. The app reaches the data server-side with
// the table owner's connection, which RLS doesn't restrict.

export const localeEnum = pgEnum("locale", ["vi", "en"]);
export const planEnum = pgEnum("plan", ["free", "pro"]);
export const marketEnum = pgEnum("market", ["vn", "international"]);
export const resumeSourceEnum = pgEnum("resume_source", ["upload", "edit", "suggestions"]);
export const analysisStatusEnum = pgEnum("analysis_status", ["pending", "running", "completed", "failed"]);
export const decisionEnum = pgEnum("suggestion_decision", ["accepted", "rejected"]);

// Deleting the Supabase Auth user cascades to everything they own.
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  locale: localeEnum("locale").notNull().default("vi"),
  plan: planEnum("plan").notNull().default("free"),
  createdAt: createdAt(),
}).enableRLS();

export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("resumes_user_idx").on(table.userId)],
).enableRLS();

export const resumeVersions = pgTable(
  "resume_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    source: resumeSourceEnum("source").notNull(),
    // Path in the private Supabase Storage bucket; null while uploads aren't stored.
    filePath: text("file_path"),
    // sha256 of the uploaded file, so re-uploading the same file skips parsing.
    contentHash: text("content_hash"),
    parsed: jsonb("parsed").$type<Resume>().notNull(),
    promptVersion: text("prompt_version"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("resume_versions_resume_version_uq").on(table.resumeId, table.version),
    index("resume_versions_content_hash_idx").on(table.contentHash),
  ],
).enableRLS();

// Shared across users: the same JD parsed once is reused by everyone applying to it.
export const jobDescriptions = pgTable("job_descriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentHash: text("content_hash").notNull().unique(),
  rawText: text("raw_text").notNull(),
  parsed: jsonb("parsed").$type<Job>().notNull(),
  promptVersion: text("prompt_version").notNull(),
  createdAt: createdAt(),
}).enableRLS();

export const analyses = pgTable(
  "analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // The row is created when the run starts, to reserve quota; these fill in as it progresses.
    resumeVersionId: uuid("resume_version_id").references(() => resumeVersions.id, { onDelete: "cascade" }),
    jobDescriptionId: uuid("job_description_id").references(() => jobDescriptions.id),
    market: marketEnum("market"),
    uiLocale: localeEnum("ui_locale").notNull(),
    status: analysisStatusEnum("status").notNull().default("pending"),
    // hash(file + JD + requested market + locale + prompt versions): identical requests reuse the result.
    cacheKey: text("cache_key").notNull(),
    ats: jsonb("ats").$type<AtsResult>(),
    result: jsonb("result").$type<Analysis>(),
    promptVersions: text("prompt_versions").array().notNull(),
    errorCode: text("error_code"),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("analyses_user_idx").on(table.userId, table.createdAt), index("analyses_cache_idx").on(table.cacheKey)],
).enableRLS();

export const suggestionDecisions = pgTable(
  "suggestion_decisions",
  {
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => analyses.id, { onDelete: "cascade" }),
    // Position in analyses.result.bullet_suggestions.
    suggestionIndex: integer("suggestion_index").notNull(),
    decision: decisionEnum("decision").notNull(),
    // The user's own wording of an accepted suggestion (e.g. with placeholders filled); null keeps the AI's.
    editedText: text("edited_text"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.analysisId, table.suggestionIndex] })],
).enableRLS();

// Hand edits on the CV preview, keyed by place in the layout (CvText.key in lib/export/document.ts).
export const cvEdits = pgTable(
  "cv_edits",
  {
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => analyses.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    // The text the edit replaced: once the CV shows something else there, the edit no longer applies.
    base: text("base").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.analysisId, table.key] })],
).enableRLS();

// The choice on analyses.result.summary_rewrite, one per analysis.
export const summaryDecisions = pgTable("summary_decisions", {
  analysisId: uuid("analysis_id")
    .primaryKey()
    .references(() => analyses.id, { onDelete: "cascade" }),
  decision: decisionEnum("decision").notNull(),
  editedText: text("edited_text"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Null for anonymous trial runs.
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    analysisId: uuid("analysis_id").references(() => analyses.id, { onDelete: "set null" }),
    step: text("step").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    // The provider's request id, for reconciling against its billing.
    requestId: text("request_id"),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    cacheWriteTokens: integer("cache_write_tokens").notNull(),
    cacheReadTokens: integer("cache_read_tokens").notNull(),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    durationMs: integer("duration_ms").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("ai_usage_user_idx").on(table.userId, table.createdAt)],
).enableRLS();

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // Positive for grants and purchases, negative for usage.
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    referenceId: text("reference_id"),
    createdAt: createdAt(),
  },
  (table) => [index("credit_ledger_user_idx").on(table.userId, table.createdAt)],
).enableRLS();
