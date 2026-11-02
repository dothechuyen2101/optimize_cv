CREATE TABLE "summary_decisions" (
	"analysis_id" uuid PRIMARY KEY NOT NULL,
	"decision" "suggestion_decision" NOT NULL,
	"edited_text" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "summary_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suggestion_decisions" ADD COLUMN "edited_text" text;--> statement-breakpoint
ALTER TABLE "summary_decisions" ADD CONSTRAINT "summary_decisions_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;