-- Per-tenant Google Sheet call log (service-account Sheets API) + a dedup marker.
ALTER TABLE "tenants" ADD COLUMN "call_log_sheet_id" TEXT;
ALTER TABLE "calls" ADD COLUMN "sheet_logged_at" TIMESTAMP(3);
