import { NextResponse, type NextRequest } from "next/server";
import { isQuoteToken } from "@/lib/quotes/service";

export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

/** The short link on a quote (/q/<code>) forwards to the quote page. Anything that isn't a quote code is a plain 404. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isQuoteToken(code)) return new NextResponse("Not found.", { status: 404, headers: PRIVATE });
  return NextResponse.redirect(new URL(`/quote/${code}`, req.url), { status: 307, headers: PRIVATE });
}
