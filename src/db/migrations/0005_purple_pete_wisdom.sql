CREATE TYPE "public"."interview_difficulty" AS ENUM('easy', 'normal', 'hard');--> statement-breakpoint
CREATE TYPE "public"."interview_role" AS ENUM('interviewer', 'candidate');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."interview_turn_kind" AS ENUM('question', 'follow_up', 'closing');--> statement-breakpoint
CREATE TYPE "public"."interview_type" AS ENUM('behavioral', 'technical', 'hr', 'mixed');--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"type" "interview_type" NOT NULL,
	"difficulty" "interview_difficulty" NOT NULL,
	"language" "locale" NOT NULL,
	"feedback" boolean NOT NULL,
	"status" "interview_status" DEFAULT 'active' NOT NULL,
	"report" jsonb,
	"prompt_versions" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "interview_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "interview_turns" (
	"session_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"role" "interview_role" NOT NULL,
	"kind" "interview_turn_kind",
	"content" text NOT NULL,
	"feedback" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_turns_session_id_position_pk" PRIMARY KEY("session_id","position")
);
--> statement-breakpoint
ALTER TABLE "interview_turns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "role_reports" (
	"analysis_id" uuid PRIMARY KEY NOT NULL,
	"status" "analysis_status" DEFAULT 'running' NOT NULL,
	"result" jsonb,
	"prompt_version" text NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "role_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_turns" ADD CONSTRAINT "interview_turns_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_reports" ADD CONSTRAINT "role_reports_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_sessions_user_idx" ON "interview_sessions" USING btree ("user_id","created_at");