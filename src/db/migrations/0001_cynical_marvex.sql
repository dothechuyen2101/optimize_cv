ALTER TABLE "analyses" ALTER COLUMN "resume_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "analyses" ALTER COLUMN "job_description_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "analyses" ALTER COLUMN "market" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "provider" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "resume_versions" ADD COLUMN "content_hash" text;--> statement-breakpoint
CREATE INDEX "resume_versions_content_hash_idx" ON "resume_versions" USING btree ("content_hash");