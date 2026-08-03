-- Optional uploaded greeting per IVR node (Supabase Storage public URL).
ALTER TABLE "ivr_nodes" ADD COLUMN "prompt_audio_url" TEXT;
