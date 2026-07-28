-- Per-tenant Google Sheet call log (Apps Script webhook) + a dedup marker.
ALTER TABLE "tenants" ADD COLUMN "call_log_webhook_url" TEXT;
ALTER TABLE "calls" ADD COLUMN "sheet_logged_at" TIMESTAMP(3);
