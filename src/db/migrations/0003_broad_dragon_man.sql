CREATE TABLE "cv_edits" (
	"analysis_id" uuid NOT NULL,
	"key" text NOT NULL,
	"base" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cv_edits_analysis_id_key_pk" PRIMARY KEY("analysis_id","key")
);
--> statement-breakpoint
ALTER TABLE "cv_edits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cv_edits" ADD CONSTRAINT "cv_edits_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;