import { NextResponse, type NextRequest } from "next/server";
import { business, getService, type ServiceId } from "@/config/business";
import { computeAvailability, visitMinutes } from "@/lib/availability";
import { calendarOpen, calendarState } from "@/lib/booking";
import { getLeadStore } from "@/lib/leads/store";

export const dynamic = "force-dynamic";

/**
 * Open start times for online booking. Contains no customer data: only free/busy.
 * `service2` = a second car's package ("help" = not sure yet): the visit takes both packages' time.
 */
export async function GET(req: NextRequest) {
  if (!calendarOpen()) return NextResponse.json({ error: "Online booking is not available." }, { status: 404 });
  const serviceId = req.nextUrl.searchParams.get("service") ?? "";
  if (!getService(serviceId)) return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  const second = req.nextUrl.searchParams.get("service2");
  if (second !== null && !getService(second) && second !== "help") return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  const store = await getLeadStore();
  if (!store) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const secondId = second === null ? null : ((getService(second) ? second : business.booking.helpHoldService) as ServiceId);
  const days = computeAvailability({
    serviceId: serviceId as ServiceId,
    ...(secondId && { durationMinutes: visitMinutes([serviceId as ServiceId, secondId]) }),
    ...(await calendarState(store)),
  });
  return NextResponse.json({ days }, { headers: { "Cache-Control": "no-store" } });
}
