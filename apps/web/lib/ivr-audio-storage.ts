import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Storage for uploaded IVR greetings, in Supabase Storage (we already use
// Supabase for Postgres — no new vendor). One public bucket, per-tenant paths so
// nothing mixes between businesses. Server-only: uses the service-role key.

const BUCKET = "ivr-audio";

// What Plivo <Play> can fetch: mp3 or wav over https. Keep files small so a
// greeting never fails silently on a real call.
export const ALLOWED_AUDIO = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
} as const;
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB

let client: SupabaseClient | null = null;
function storage(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function storageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Upload (or replace) a node's greeting. Returns its public URL. */
export async function uploadIvrAudio(
  tenantId: string,
  nodeId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  const sb = storage();
  if (!sb) return { error: "Audio storage isn't configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." };

  const ext = ALLOWED_AUDIO[file.type as keyof typeof ALLOWED_AUDIO];
  if (!ext) return { error: "Upload an MP3 or WAV file." };
  if (file.size > MAX_AUDIO_BYTES) return { error: "File is too large — keep it under 5 MB." };

  // Per-tenant path; upsert so re-uploading replaces the old file.
  const path = `${tenantId}/${nodeId}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (error) return { error: `Upload failed: ${error.message}` };

  // Cache-bust so Plivo/CDN picks up a replaced file rather than a stale one.
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { url: `${data.publicUrl}?v=${Date.now()}` };
}

/** Delete a node's greeting from storage, given the stored public URL. */
export async function removeIvrAudio(publicUrl: string): Promise<void> {
  const sb = storage();
  if (!sb) return;
  // Extract the object path after "/<BUCKET>/", dropping any ?v= cache-buster.
  const m = publicUrl.split("?")[0].match(new RegExp(`/${BUCKET}/(.+)$`));
  if (!m) return;
  await sb.storage.from(BUCKET).remove([m[1]]);
}
