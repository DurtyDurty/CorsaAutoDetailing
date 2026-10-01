import { NextResponse, type NextRequest } from "next/server";
import { getService, type ServiceId } from "@/config/business";
import { computeAvailability } from "@/lib/availability";
import { calendarOpen, calendarState } from "@/lib/booking";
import { getLeadStore } from "@/lib/leads/store";

export const dynamic = "force-dynamic";

/** Open start times for online booking. Contains no customer data: only free/busy. */
export async function GET(req: NextRequest) {
  if (!calendarOpen()) return NextResponse.json({ error: "Online booking is not available." }, { status: 404 });
  const serviceId = req.nextUrl.searchParams.get("service") ?? "";
  if (!getService(serviceId)) return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  const store = await getLeadStore();
  if (!store) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const days = computeAvailability({ serviceId: serviceId as ServiceId, ...(await calendarState(store)) });
  return NextResponse.json({ days }, { headers: { "Cache-Control": "no-store" } });
}
