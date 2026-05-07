ALTER TABLE "monitors"
ADD COLUMN "tags" text[] NOT NULL DEFAULT '{}'::text[];
