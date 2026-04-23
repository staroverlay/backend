ALTER TABLE "integrations" ADD COLUMN "eventsub_sync_error" text;--> statement-breakpoint
CREATE INDEX "uploads_profile_created_idx" ON "uploads" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "wi_widget_idx" ON "widget_integrations" USING btree ("widget_id");--> statement-breakpoint
CREATE INDEX "wi_integration_idx" ON "widget_integrations" USING btree ("integration_id");--> statement-breakpoint
ALTER TABLE "widgets" DROP COLUMN "token_expires_at";--> statement-breakpoint
ALTER TABLE "widgets" DROP COLUMN "token_revoked_at";