DO $$ BEGIN
 CREATE TYPE "public"."actions_enum" AS ENUM('unban', 'kick', 'warn', 'timeout', 'ban', 'note', 'restrain', 'untimeout');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "action_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action_id" integer NOT NULL,
	"message_id" text NOT NULL,
	"channel_id" text NOT NULL,
	CONSTRAINT "action_logs_action_id_unique" UNIQUE("action_id"),
	CONSTRAINT "action_logs_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action" "actions_enum" NOT NULL,
	"body" text,
	"dm" boolean NOT NULL,
	"staff_id" text NOT NULL,
	"timeout" integer,
	"timestamp" timestamp NOT NULL,
	"dm_success" boolean NOT NULL,
	"action_success" boolean NOT NULL,
	"delete_message_seconds" integer,
	"timed_out_until" timestamp,
	"revoked" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"action_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"xp" integer NOT NULL,
	"name" text NOT NULL,
	"avatar" text,
	"discriminator" text NOT NULL,
	"member" boolean NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
