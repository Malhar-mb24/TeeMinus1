CREATE TABLE "user_reminder_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"focus_reminder_enabled" boolean DEFAULT false NOT NULL,
	"focus_reminder_time" text DEFAULT '09:30' NOT NULL,
	"break_reminder_enabled" boolean DEFAULT true NOT NULL,
	"break_interval_minutes" integer DEFAULT 50 NOT NULL,
	"daily_goal_reminder_enabled" boolean DEFAULT false NOT NULL,
	"daily_goal_reminder_time" text DEFAULT '18:00' NOT NULL,
	"habit_reminder_enabled" boolean DEFAULT false NOT NULL,
	"habit_reminder_time" text DEFAULT '20:00' NOT NULL,
	"quiet_hours_enabled" boolean DEFAULT true NOT NULL,
	"quiet_hours_start" text DEFAULT '22:00' NOT NULL,
	"quiet_hours_end" text DEFAULT '07:30' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_reminder_preferences" ADD CONSTRAINT "user_reminder_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;