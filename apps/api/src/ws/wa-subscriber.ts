import { prisma } from "@itsolute/db";
import { env } from "../env.js";
import { applyStatusUpdate, applyInboundReply } from "../services/recovery-events.js";

// Real-time ingestion: subscribe to the WhatsApp platform's WebSocket
// (ws?brand=<slug>) and apply status + reply events as they happen. Uses Node's
// built-in global WebSocket (Node 20+) — no dependency. The reconciliation poll
// backstops anything missed while a socket is down.
//
// Platform events (see whatsapp-platform handlers):
//   { type: 'MESSAGE_STATUS', brandSlug, waMessageId, status }        // SENT|DELIVERED|READ|FAILED
//   { type: 'NEW_MESSAGE',    brandSlug, message: { direction, contact: { waId }, body } }

const MAX_BACKOFF_MS = 30_000;

interface PlatformEvent {
  type?: string;
  brandSlug?: string;
  waMessageId?: string;
  status?: string;
  message?: { direction?: string; contact?: { waId?: string }; body?: string };
}

class BrandSocket {
  private ws: WebSocket | null = null;
  private backoff = 1000;
  private closed = false;

  constructor(
    private wsBase: string,
    private brandSlug: string,
  ) {}

  start() {
    if (this.closed) return;
    const url = `${this.wsBase}${this.wsBase.includes("?") ? "&" : "?"}brand=${encodeURIComponent(this.brandSlug)}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.backoff = 1000;
      console.log(`[wa:ws] connected brand=${this.brandSlug}`);
    });
    ws.addEventListener("message", (ev: MessageEvent) => {
      void this.onMessage(typeof ev.data === "string" ? ev.data : String(ev.data));
    });
    ws.addEventListener("close", () => this.scheduleReconnect());
    ws.addEventListener("error", () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    });
  }

  private async onMessage(raw: string) {
    let ev: PlatformEvent;
    try {
      ev = JSON.parse(raw);
    } catch {
      return;
    }
    try {
      if (ev.type === "MESSAGE_STATUS" && ev.waMessageId && ev.status) {
        await applyStatusUpdate({ waMessageId: ev.waMessageId, platformStatus: ev.status });
      } else if (ev.type === "NEW_MESSAGE" && ev.message?.direction === "INBOUND") {
        const waId = ev.message.contact?.waId;
        const brandSlug = ev.brandSlug ?? this.brandSlug;
        if (waId) await applyInboundReply({ brandSlug, waId });
      }
    } catch (err) {
      console.error(`[wa:ws] handler error brand=${this.brandSlug}:`, (err as Error).message);
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    console.warn(`[wa:ws] disconnected brand=${this.brandSlug}, reconnecting in ${delay}ms`);
    setTimeout(() => this.start(), delay);
  }

  stop() {
    this.closed = true;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
  }
}

export interface WaSubscriber {
  stop: () => void;
}

/** Open one socket per distinct connected brand slug. */
export async function startWaSubscriber(): Promise<WaSubscriber> {
  if (!env.waPlatformWsUrl) {
    console.warn("[wa:ws] WA_PLATFORM_WS_URL not set — real-time status/reply disabled");
    return { stop: () => {} };
  }
  if (typeof WebSocket === "undefined") {
    console.error("[wa:ws] global WebSocket unavailable (needs Node 20+) — real-time disabled");
    return { stop: () => {} };
  }

  const senders = await prisma.whatsAppSender.findMany({
    where: { status: "connected", platformBrandSlug: { not: null } },
    select: { platformBrandSlug: true },
    distinct: ["platformBrandSlug"],
  });
  const slugs = senders.map((s) => s.platformBrandSlug!).filter(Boolean);

  const sockets = slugs.map((slug) => {
    const s = new BrandSocket(env.waPlatformWsUrl, slug);
    s.start();
    return s;
  });
  console.log(`[wa:ws] subscribing to ${sockets.length} brand(s)`);

  return { stop: () => sockets.forEach((s) => s.stop()) };
}
