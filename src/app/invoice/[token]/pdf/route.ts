import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getLeadStore } from "@/lib/leads/store";
import { checkRateLimit } from "@/lib/rate-limit";
import { invoiceFilename, loadInvoiceByToken, renderInvoice } from "@/lib/owner/invoice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkRateLimit(`invoice-pdf:${createHash("sha256").update(ip).digest("hex").slice(0, 24)}`, 30, 10 * 60_000);
  if (!limit.ok) return new NextResponse("Too many requests.", { status: 429, headers: { ...PRIVATE, "Retry-After": String(limit.retryAfterSeconds) } });

  const { token } = await params;
  const store = await getLeadStore();
  const appointment = store ? await loadInvoiceByToken(store, token) : null;
  if (!appointment) return new NextResponse("Not found.", { status: 404, headers: PRIVATE });

  return new NextResponse(Buffer.from(await renderInvoice(appointment)), {
    headers: {
      ...PRIVATE,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceFilename(appointment)}"`,
    },
  });
}