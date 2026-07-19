-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantMode" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('recovery', 'recovery_pro', 'front_desk', 'ai_front_desk');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('trial', 'active', 'paused');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'staff', 'admin');

-- CreateEnum
CREATE TYPE "PlivoNumberStatus" AS ENUM ('active', 'released');

-- CreateEnum
CREATE TYPE "WhatsAppProvider" AS ENUM ('own', 'embedded');

-- CreateEnum
CREATE TYPE "QualityRating" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "WhatsAppSenderStatus" AS ENUM ('connected', 'disconnected', 'flagged');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('utility', 'marketing', 'authentication');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('approved', 'pending', 'rejected');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('ringing', 'answered', 'missed', 'recovered');

-- CreateEnum
CREATE TYPE "RecoveryStatus" AS ENUM ('queued', 'sent', 'delivered', 'read', 'replied', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "RecoveryStatusReason" AS ENUM ('not_on_whatsapp', 'cooldown', 'quiet_hours_deferred', 'no_sender', 'no_template');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('recovery', 'manual');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('requested', 'confirmed', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "IvrAction" AS ENUM ('ring_staff', 'submenu', 'voicemail', 'hangup');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "business_hours" JSONB NOT NULL DEFAULT '{}',
    "booking_url" TEXT,
    "avg_job_value" INTEGER NOT NULL DEFAULT 0,
    "mode" "TenantMode" NOT NULL DEFAULT 'A',
    "plan" "Plan" NOT NULL DEFAULT 'recovery',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'monthly',
    "ai_enabled" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_fee" INTEGER,
    "status" "TenantStatus" NOT NULL DEFAULT 'trial',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plivo_numbers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "e164" TEXT NOT NULL,
    "plivo_app_id" TEXT,
    "status" "PlivoNumberStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plivo_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_senders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" "WhatsAppProvider" NOT NULL DEFAULT 'own',
    "waba_id" TEXT,
    "phone_number_id" TEXT,
    "display_e164" TEXT NOT NULL,
    "display_name" TEXT,
    "quality_rating" "QualityRating",
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "WhatsAppSenderStatus" NOT NULL DEFAULT 'disconnected',
    "connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_senders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" "TemplateCategory" NOT NULL DEFAULT 'utility',
    "status" "TemplateStatus" NOT NULL DEFAULT 'pending',
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plivo_number_id" UUID,
    "caller_e164" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL DEFAULT 'inbound',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER NOT NULL DEFAULT 0,
    "billable_sec" INTEGER NOT NULL DEFAULT 0,
    "status" "CallStatus" NOT NULL DEFAULT 'ringing',
    "route_path" JSONB,
    "recording_url" TEXT,
    "plivo_call_uuid" TEXT,
    "raw" JSONB,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "call_id" UUID NOT NULL,
    "caller_e164" TEXT NOT NULL,
    "whatsapp_sender_id" UUID,
    "template_id" UUID,
    "wa_message_id" TEXT,
    "status" "RecoveryStatus" NOT NULL DEFAULT 'queued',
    "status_reason" "RecoveryStatusReason",
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "call_id" UUID,
    "caller_e164" TEXT NOT NULL,
    "source" "BookingSource" NOT NULL DEFAULT 'recovery',
    "status" "BookingStatus" NOT NULL DEFAULT 'requested',
    "scheduled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "e164" TEXT NOT NULL,
    "ring_order" INTEGER NOT NULL DEFAULT 0,
    "alert_on_missed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ivr_nodes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "key" TEXT,
    "prompt" TEXT NOT NULL,
    "action" "IvrAction" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ivr_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_daily" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "recovery_messages" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "plivo_numbers_e164_key" ON "plivo_numbers"("e164");

-- CreateIndex
CREATE INDEX "plivo_numbers_tenant_id_idx" ON "plivo_numbers"("tenant_id");

-- CreateIndex
CREATE INDEX "whatsapp_senders_tenant_id_idx" ON "whatsapp_senders"("tenant_id");

-- CreateIndex
CREATE INDEX "templates_tenant_id_idx" ON "templates"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "calls_plivo_call_uuid_key" ON "calls"("plivo_call_uuid");

-- CreateIndex
CREATE INDEX "calls_tenant_id_started_at_idx" ON "calls"("tenant_id", "started_at");

-- CreateIndex
CREATE INDEX "calls_tenant_id_caller_e164_idx" ON "calls"("tenant_id", "caller_e164");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_messages_wa_message_id_key" ON "recovery_messages"("wa_message_id");

-- CreateIndex
CREATE INDEX "recovery_messages_tenant_id_created_at_idx" ON "recovery_messages"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "recovery_messages_tenant_id_caller_e164_idx" ON "recovery_messages"("tenant_id", "caller_e164");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_created_at_idx" ON "bookings"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "staff_tenant_id_ring_order_idx" ON "staff"("tenant_id", "ring_order");

-- CreateIndex
CREATE INDEX "ivr_nodes_tenant_id_parent_id_idx" ON "ivr_nodes"("tenant_id", "parent_id");

-- CreateIndex
CREATE INDEX "usage_daily_tenant_id_date_idx" ON "usage_daily"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "usage_daily_tenant_id_date_key" ON "usage_daily"("tenant_id", "date");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plivo_numbers" ADD CONSTRAINT "plivo_numbers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_senders" ADD CONSTRAINT "whatsapp_senders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_plivo_number_id_fkey" FOREIGN KEY ("plivo_number_id") REFERENCES "plivo_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_messages" ADD CONSTRAINT "recovery_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_messages" ADD CONSTRAINT "recovery_messages_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_messages" ADD CONSTRAINT "recovery_messages_whatsapp_sender_id_fkey" FOREIGN KEY ("whatsapp_sender_id") REFERENCES "whatsapp_senders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_messages" ADD CONSTRAINT "recovery_messages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ivr_nodes" ADD CONSTRAINT "ivr_nodes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ivr_nodes" ADD CONSTRAINT "ivr_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "ivr_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

