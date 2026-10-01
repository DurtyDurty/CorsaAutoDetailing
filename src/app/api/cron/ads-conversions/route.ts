import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getLeadStore } from "@/lib/leads/store";
import { uploadConversions } from "@/lib/ads/upload";

export const dynamic = "force-dynamic";

/**
 * Reports confirmed bookings (and inquiries / payments, if their conversion
 * actions are configured) from Google Ads clicks to Google Ads. Vercel Cron
 * calls it daily with `Authorization: Bearer $CRON_SECRET`. Does nothing
 * until GOOGLE_ADS_CONVERSION_UPLOADS is "validate" or "on".
 * The response has ids, counts and errors only: no customer details.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || provided.length !== secret.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const store = await getLeadStore();
  if (!store) return NextResponse.json({ error: "store unavailable" }, { status: 503 });
  try {
    const result = await uploadConversions(store);
    return NextResponse.json(result, { status: result.failed.length ? 207 : 200 });
  } catch (err) {
    console.error("[ads-conversions]", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 502 });
  }
}
