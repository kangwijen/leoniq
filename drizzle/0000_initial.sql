CREATE TYPE "public"."monitor_status" AS ENUM('up', 'down');
CREATE TYPE "public"."monitor_type" AS ENUM('http', 'tcp');

CREATE TABLE "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL,
  CONSTRAINT "session_token_unique" UNIQUE("token")
);

CREATE TABLE "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "monitors" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "type" "monitor_type" NOT NULL,
  "url" text,
  "host" text,
  "port" integer,
  "method" text DEFAULT 'GET' NOT NULL,
  "expected_status_min" integer DEFAULT 200 NOT NULL,
  "expected_status_max" integer DEFAULT 399 NOT NULL,
  "interval_seconds" integer DEFAULT 60 NOT NULL,
  "timeout_ms" integer DEFAULT 5000 NOT NULL,
  "retries" integer DEFAULT 1 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "last_checked_at" timestamp with time zone,
  "last_status" "monitor_status",
  "last_latency_ms" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "check_results" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "monitor_id" uuid NOT NULL,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" "monitor_status" NOT NULL,
  "latency_ms" integer,
  "status_code" integer,
  "error_message" text,
  "meta" jsonb
);

CREATE TABLE "incidents" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "monitor_id" uuid NOT NULL,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "closed_at" timestamp with time zone,
  "reason" text,
  "resolved" boolean DEFAULT false NOT NULL
);

CREATE TABLE "alert_events" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "monitor_id" uuid NOT NULL,
  "incident_id" uuid,
  "type" text NOT NULL,
  "payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "monitor_worker_locks" (
  "monitor_id" uuid NOT NULL,
  "locked_until" timestamp with time zone NOT NULL,
  CONSTRAINT "monitor_worker_locks_monitor_id_uidx" UNIQUE("monitor_id")
);

CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
CREATE INDEX "monitors_user_id_idx" ON "monitors" USING btree ("user_id");
CREATE INDEX "monitors_user_active_idx" ON "monitors" USING btree ("user_id","active");
CREATE INDEX "check_results_monitor_time_idx" ON "check_results" USING btree ("monitor_id","checked_at");
CREATE INDEX "check_results_time_idx" ON "check_results" USING btree ("checked_at");
CREATE INDEX "incidents_monitor_id_idx" ON "incidents" USING btree ("monitor_id");
CREATE INDEX "alert_events_monitor_id_idx" ON "alert_events" USING btree ("monitor_id");

ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_user_id_user_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "check_results" ADD CONSTRAINT "check_results_monitor_id_monitors_id_fk"
FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_monitor_id_monitors_id_fk"
FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_monitor_id_monitors_id_fk"
FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_incident_id_incidents_id_fk"
FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "monitor_worker_locks" ADD CONSTRAINT "monitor_worker_locks_monitor_id_monitors_id_fk"
FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;
