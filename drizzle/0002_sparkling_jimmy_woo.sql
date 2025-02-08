CREATE TABLE IF NOT EXISTS "toyhouse" (
	"code" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"taken" text,
	CONSTRAINT "toyhouse_taken_unique" UNIQUE("taken")
);
