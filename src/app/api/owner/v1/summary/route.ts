import type { TodaySummary } from "@shared/api";
import { json, withOwner } from "@/lib/api/http";
import { requireStore } from "@/lib/owner/store";
import { todaySummary } from "@/lib/owner/summary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Everything the Today screen needs in one request. */
export const GET = withOwner(async () => json<TodaySummary>(await todaySummary(await requireStore())));