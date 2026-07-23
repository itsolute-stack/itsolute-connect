// Shared client for the self-hosted WhatsApp platform's authenticated REST API
// (the JWT-protected /api/* endpoints — conversations, templates). Auth is a
// platform login (WA_PLATFORM_USER_EMAIL/PASSWORD) exchanged for a bearer token,
// cached in-process and refreshed on a 401. Every call is resilient: it returns
// a typed result instead of throwing, so a page never 500s because the platform
// is briefly unreachable.

let cachedToken: string | null = null;

export function waBase(): string | null {
  return process.env.WA_PLATFORM_BASE_URL ? process.env.WA_PLATFORM_BASE_URL.replace(/\/$/, "") : null;
}

export function waLoginConfigured(): boolean {
  return Boolean(process.env.WA_PLATFORM_USER_EMAIL && process.env.WA_PLATFORM_USER_PASSWORD);
}

async function login(b: string): Promise<string | null> {
  try {
    const res = await fetch(`${b}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: process.env.WA_PLATFORM_USER_EMAIL,
        password: process.env.WA_PLATFORM_USER_PASSWORD,
      }),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return j?.token ?? null;
  } catch {
    return null;
  }
}

/** Make an authenticated request, refreshing the token once on a 401. */
async function authedFetch(b: string, path: string, init?: RequestInit): Promise<Response | null> {
  let token = cachedToken ?? (await login(b));
  if (!token) return null;
  const call = (t: string) =>
    fetch(`${b}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), authorization: `Bearer ${t}` },
      cache: "no-store",
    });
  let res = await call(token);
  if (res.status === 401) {
    token = await login(b);
    if (!token) return null;
    cachedToken = token;
    res = await call(token);
  } else {
    cachedToken = token;
  }
  return res;
}

export interface WaResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

async function readError(res: Response): Promise<string> {
  try {
    const j: any = await res.json();
    return j?.error || j?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function waGet<T>(path: string): Promise<WaResult<T>> {
  const b = waBase();
  if (!b) return { ok: false, error: "WhatsApp platform not configured (WA_PLATFORM_BASE_URL)." };
  if (!waLoginConfigured()) return { ok: false, error: "Platform login not configured (WA_PLATFORM_USER_EMAIL/PASSWORD)." };
  const res = await authedFetch(b, path);
  if (!res) return { ok: false, error: "Couldn't reach or authenticate to the WhatsApp platform." };
  if (!res.ok) return { ok: false, status: res.status, error: await readError(res) };
  return { ok: true, data: (await res.json()) as T };
}

export async function waPost<T>(path: string, body: unknown): Promise<WaResult<T>> {
  const b = waBase();
  if (!b) return { ok: false, error: "WhatsApp platform not configured (WA_PLATFORM_BASE_URL)." };
  if (!waLoginConfigured()) return { ok: false, error: "Platform login not configured (WA_PLATFORM_USER_EMAIL/PASSWORD)." };
  const res = await authedFetch(b, path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res) return { ok: false, error: "Couldn't reach or authenticate to the WhatsApp platform." };
  if (!res.ok) return { ok: false, status: res.status, error: await readError(res) };
  return { ok: true, data: (await res.json()) as T };
}

/** Thin helper kept for the conversation view (returns null on any failure). */
export async function authedGetJson<T>(path: string): Promise<T | null> {
  const r = await waGet<T>(path);
  return r.ok ? (r.data ?? null) : null;
}
