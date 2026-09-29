import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { storeKind } from "@/lib/leads/store";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  /** Resend drops a repeat send with the same key (24h window). */
  idempotencyKey?: string;
}

export interface EmailAdapter {
  readonly kind: "resend" | "demo" | "disabled";
  send(message: EmailMessage): Promise<{ id: string }>;
}

export function emailKind(): EmailAdapter["kind"] {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "resend";
  // The demo outbox pairs with the demo store (local dev, e2e builds); never with real data.
  if (process.env.NODE_ENV !== "production" || storeKind() === "demo") return "demo";
  return "disabled";
}

/** Resend via its REST API — no SDK dependency needed. */
class ResendAdapter implements EmailAdapter {
  readonly kind = "resend" as const;
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send(message: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        reply_to: message.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { id?: string };
    return { id: json.id ?? "unknown" };
  }
}

/** DEMO: appends to .data/demo-outbox.json so you can inspect what would have been sent. */
class DemoOutboxAdapter implements EmailAdapter {
  readonly kind = "demo" as const;

  async send(message: EmailMessage) {
    const file = path.join(process.cwd(), ".data", "demo-outbox.json");
    await fs.mkdir(path.dirname(file), { recursive: true });
    let outbox: unknown[] = [];
    try {
      outbox = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      outbox = [];
    }
    const id = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    outbox.push({ id, sentAt: new Date().toISOString(), ...message });
    await fs.writeFile(file, JSON.stringify(outbox, null, 2), "utf8");
    if (process.env.NODE_ENV !== "test") {
      console.info(`[demo email] → ${message.to}: ${message.subject}`);
    }
    return { id };
  }
}

class DisabledAdapter implements EmailAdapter {
  readonly kind = "disabled" as const;
  async send(): Promise<{ id: string }> {
    throw new Error("Email is not configured (RESEND_API_KEY / EMAIL_FROM missing).");
  }
}

let cached: EmailAdapter | undefined;

export function getEmailAdapter(): EmailAdapter {
  if (cached) return cached;
  const kind = emailKind();
  cached =
    kind === "resend"
      ? new ResendAdapter(process.env.RESEND_API_KEY!, process.env.EMAIL_FROM!)
      : kind === "demo"
        ? new DemoOutboxAdapter()
        : new DisabledAdapter();
  return cached;
}

export function resetEmailAdapterCache() {
  cached = undefined;
}
