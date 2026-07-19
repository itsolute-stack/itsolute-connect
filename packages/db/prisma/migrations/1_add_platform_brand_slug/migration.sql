-- Add the existing WhatsApp platform brand slug to whatsapp_senders.
ALTER TABLE "whatsapp_senders" ADD COLUMN "platform_brand_slug" TEXT;
