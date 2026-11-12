CREATE TABLE "achievements" (
	"code" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"xp_reward" integer NOT NULL,
	"category" text NOT NULL,
	"threshold" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"planned_duration_seconds" integer,
	"started_at" timestamp with time zone NOT NULL,
	"last_resumed_at" timestamp with time zone,
	"accumulated_seconds" integer DEFAULT 0 NOT NULL,
	"ended_at" timestamp with time zone,
	"local_date" text NOT NULL,
	"label" text,
	"notes" text,
	"soundscape" text DEFAULT 'none' NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"completion_idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period_type" text NOT NULL,
	"period_key" text NOT NULL,
	"target_minutes" integer NOT NULL,
	"target_sessions" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" text NOT NULL,
	"status" text NOT NULL,
	"progress_count" integer DEFAULT 1 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'Betterment' NOT NULL,
	"icon" text DEFAULT 'check' NOT NULL,
	"color" text DEFAULT '#10B981' NOT NULL,
	"schedule_type" text DEFAULT 'daily' NOT NULL,
	"scheduled_days" integer[] DEFAULT '{0,1,2,3,4,5,6}' NOT NULL,
	"target_per_day" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'Study' NOT NULL,
	"color" text DEFAULT '#38BDF8' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"planned_minutes" integer DEFAULT 30 NOT NULL,
	"scheduled_date" text,
	"planned_start_minute" integer,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_code" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"current_focus_streak_days" integer DEFAULT 0 NOT NULL,
	"best_focus_streak_days" integer DEFAULT 0 NOT NULL,
	"last_qualifying_focus_date" text,
	"unlocked_cosmetics" text[] DEFAULT '{"classic-flame"}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"xp_delta" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_code_achievements_code_fk" FOREIGN KEY ("achievement_code") REFERENCES "public"."achievements"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "focus_sessions_user_status_idx" ON "focus_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "focus_sessions_user_local_date_idx" ON "focus_sessions" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "focus_sessions_user_started_at_idx" ON "focus_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "focus_sessions_user_idempotency_uidx" ON "focus_sessions" USING btree ("user_id","completion_idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_user_period_uidx" ON "goals" USING btree ("user_id","period_type","period_key");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_entries_habit_user_date_uidx" ON "habit_entries" USING btree ("habit_id","user_id","local_date");--> statement-breakpoint
CREATE INDEX "habit_entries_user_local_date_idx" ON "habit_entries" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "habits_user_archived_idx" ON "habits" USING btree ("user_id","archived");--> statement-breakpoint
CREATE INDEX "tasks_user_scheduled_date_idx" ON "tasks" USING btree ("user_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "tasks_user_status_idx" ON "tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_achievements_user_code_uidx" ON "user_achievements" USING btree ("user_id","achievement_code");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_events_user_idempotency_uidx" ON "xp_events" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "xp_events_user_created_at_idx" ON "xp_events" USING btree ("user_id","created_at");