CREATE TABLE "app_usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"local_date" text NOT NULL,
	"app_name" text NOT NULL,
	"display_name" text NOT NULL,
	"active_seconds" integer DEFAULT 0 NOT NULL,
	"launch_count" integer DEFAULT 1 NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_pairing_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"device_type" text DEFAULT 'chrome_extension' NOT NULL,
	"suggested_name" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" text DEFAULT 'website' NOT NULL,
	"pattern" text NOT NULL,
	"category" text DEFAULT 'neutral' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"local_date" text NOT NULL,
	"hostname" text NOT NULL,
	"active_seconds" integer DEFAULT 0 NOT NULL,
	"visit_count" integer DEFAULT 1 NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extension_devices" ADD COLUMN "device_type" text DEFAULT 'chrome_extension' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_usage_daily" ADD CONSTRAINT "app_usage_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_usage_daily" ADD CONSTRAINT "app_usage_daily_device_id_extension_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."extension_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pairing_codes" ADD CONSTRAINT "device_pairing_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_categories" ADD CONSTRAINT "website_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_usage_daily" ADD CONSTRAINT "website_usage_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_usage_daily" ADD CONSTRAINT "website_usage_daily_device_id_extension_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."extension_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_usage_daily_device_date_app_uidx" ON "app_usage_daily" USING btree ("user_id","device_id","local_date","app_name");--> statement-breakpoint
CREATE INDEX "app_usage_daily_user_date_idx" ON "app_usage_daily" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "device_pairing_codes_code_hash_uidx" ON "device_pairing_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "device_pairing_codes_user_expires_idx" ON "device_pairing_codes" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "website_categories_user_target_pattern_uidx" ON "website_categories" USING btree ("user_id","target_type","pattern");--> statement-breakpoint
CREATE UNIQUE INDEX "website_usage_daily_device_date_host_uidx" ON "website_usage_daily" USING btree ("user_id","device_id","local_date","hostname");--> statement-breakpoint
CREATE INDEX "website_usage_daily_user_date_idx" ON "website_usage_daily" USING btree ("user_id","local_date");