create table "webhook_attempts" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" text not null references "user"("id") on delete cascade,
  "webhook_url" text not null,
  "success" boolean not null,
  "status_code" integer,
  "error_message" text,
  "payload" jsonb,
  "created_at" timestamp with time zone not null default now()
)

create index "webhook_attempts_user_id_idx" on "webhook_attempts" ("user_id")
create index "webhook_attempts_created_at_idx" on "webhook_attempts" ("created_at")
