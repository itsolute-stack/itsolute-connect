-- Mode B call recording toggle.
ALTER TABLE "tenants" ADD COLUMN "record_calls" BOOLEAN NOT NULL DEFAULT false;
