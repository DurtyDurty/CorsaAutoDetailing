import { NextResponse, type NextRequest } from "next/server";
import { getLeadStore } from "@/lib/leads/store";
import { checkRateLimit } from "@/lib/rate-limit";
import { renderQuotePdf } from "@/lib/quotes/pdf";
import { loadQuoteByToken, pdfFilename, quoteDocument, quoteUrl } from "@/lib/quotes/service";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

/** The customer's quote as a PDF. The token in the path is the only key; it's never logged or stored. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkRateLimit(`quote-pdf:${createHash("sha256").update(ip).digest("hex").slice(0, 24)}`, 30, 10 * 60_000);
  if (!limit.ok) return new NextResponse("Too many requests.", { status: 429, headers: { ...PRIVATE, "Retry-After": String(limit.retryAfterSeconds) } });

  const { token } = await params;
  const store = await getLeadStore();
  const found = store ? await loadQuoteByToken(store, token) : null;
  if (!found) return new NextResponse("Not found.", { status: 404, headers: PRIVATE });

  const pdf = await renderQuotePdf(quoteDocument(found.quote, found.appointment, found.lead, found.status === "sent" ? quoteUrl(token) : null));
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      ...PRIVATE,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFilename(found.quote)}"`,
    },
  });
}
