import { NextResponse, type NextRequest } from "next/server";
import { ownerOrNull } from "@/lib/auth/owner";
import { ApiError } from "@/lib/api/http";
import { getLeadStore } from "@/lib/leads/store";
import { getAppointmentDetail } from "@/lib/owner/appointments";
import { invoiceFilename, isInvoiceable, renderInvoice } from "@/lib/owner/invoice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The owner's copy of a job's invoice, as it stands now (the customer gets theirs with the work confirmation). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ownerOrNull())) return new NextResponse("Unauthorized", { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { id } = await params;
  const store = await getLeadStore();
  if (!store || !UUID.test(id)) return new NextResponse("Not found.", { status: 404 });
  let a;
  try {
    a = await getAppointmentDetail(store, id);
  } catch (err) {
    if (err instanceof ApiError && err.code === "not_found") return new NextResponse("Not found.", { status: 404 });
    throw err;
  }
  if (!isInvoiceable(a)) return new NextResponse("Not found.", { status: 404 });
  return new NextResponse(Buffer.from(await renderInvoice(a)), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceFilename(a)}"`,
    },
  });
}
