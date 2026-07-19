-- Per-tenant staff-alert template (used when a missed caller replies).
ALTER TABLE "tenants" ADD COLUMN "alert_template_name" TEXT;
