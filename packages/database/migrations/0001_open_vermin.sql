CREATE TYPE "public"."relay_mode" AS ENUM('momentary', 'latch');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relay_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kiosk_id" uuid NOT NULL,
	"relay_index" integer NOT NULL,
	"gpio_pin" integer NOT NULL,
	"label" varchar(100) NOT NULL,
	"mode" "relay_mode" DEFAULT 'momentary' NOT NULL,
	"duration_ms" integer,
	"access_point_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relay_outputs_kiosk_index" UNIQUE("kiosk_id","relay_index"),
	CONSTRAINT "relay_outputs_kiosk_pin" UNIQUE("kiosk_id","gpio_pin")
);
--> statement-breakpoint
ALTER TABLE "calls" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "calls" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relay_outputs" ADD CONSTRAINT "relay_outputs_kiosk_id_kiosks_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relay_outputs" ADD CONSTRAINT "relay_outputs_access_point_id_access_points_id_fk" FOREIGN KEY ("access_point_id") REFERENCES "public"."access_points"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
