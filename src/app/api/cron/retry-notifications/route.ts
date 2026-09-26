import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getLeadStore } from "@/lib/leads/store";
import { retryFailedNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * Retries failed notifications. Call from a scheduler with
 * `Authorization: Bearer $CRON_SECRET`. Disabled when CRON_SECRET is unset.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || provided.length !== secret.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const store = await getLeadStore();
  if (!store) return NextResponse.json({ retried: 0, error: "store unavailable" }, { status: 503 });
  const retried = await retryFailedNotifications(store);
  return NextResponse.json({ retried });
}
