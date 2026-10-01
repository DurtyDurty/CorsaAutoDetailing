import type { BookingOptions } from "@shared/api";
import { json, withOwner } from "@/lib/api/http";
import { bookingOptions } from "@/lib/owner/schedule";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Services, prices and scheduling defaults for the booking form. */
export const GET = withOwner(async () => json<BookingOptions>(bookingOptions()));