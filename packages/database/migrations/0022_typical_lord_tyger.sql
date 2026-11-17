CREATE TYPE "public"."pass_recurrence" AS ENUM('once', 'range', 'weekly');
ALTER TABLE "access_passes" ADD COLUMN "recurrence" "pass_recurrence" DEFAULT 'once' NOT NULL;
