// Plivo delivers numbers as bare digits or with a leading +. Normalize to a
// single canonical E.164 form (leading +, digits only) so tenant lookup by the
// dialed number and caller de-duplication are consistent.
export function normalizeE164(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `+${digits}`;
}
