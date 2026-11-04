CREATE TABLE "project_imports" (
	"analysis_id" uuid PRIMARY KEY NOT NULL,
	"status" "analysis_status" DEFAULT 'running' NOT NULL,
	"source" text NOT NULL,
	"result" jsonb,
	"decisions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prompt_version" text NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "project_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_imports" ADD CONSTRAINT "project_imports_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;