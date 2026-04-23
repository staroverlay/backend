ALTER TABLE "integrations" ADD COLUMN "eventsub_subscriptions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "eventsub_secret" text;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "eventsub_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "eventsub_last_sync_at" timestamp;