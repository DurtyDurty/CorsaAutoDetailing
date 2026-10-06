import { NextResponse, type NextRequest } from "next/server";
import { ownerOrNull } from "@/lib/auth/owner";
import { getLeadStore } from "@/lib/leads/store";
import { renderQuotePdf } from "@/lib/quotes/pdf";
import { pdfFilename, quoteDocument } from "@/lib/quotes/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The owner's copy of the latest quote for a job. It has no accept link: only the customer's email carries that. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ownerOrNull())) return new NextResponse("Unauthorized", { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { id } = await params;
  const store = await getLeadStore();
  if (!store || !UUID.test(id)) return new NextResponse("Not found.", { status: 404 });
  const appt = await store.getAppointment(id);
  const [quote] = appt ? await store.listQuotesForAppointments([appt.id]) : [];
  if (!appt || !quote) return new NextResponse("Not found.", { status: 404 });
  const pdf = await renderQuotePdf(quoteDocument(quote, appt, await store.getLead(appt.leadId), null));
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFilename(quote)}"`,
    },
  });
}
