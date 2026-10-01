"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAppointmentSchema, OVERRIDABLE } from "@shared/api";
import { requireOwner } from "@/lib/auth/owner";
import { ApiError } from "@/lib/api/http";
import { getLeadStore } from "@/lib/leads/store";
import { bookFromApp } from "@/lib/owner/schedule";

export interface BookState {
  error: string | null;
  /** The time is outside working hours or on a day off: the form offers "Book anyway". */
  canOverride: boolean;
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
};

/** Book from the web dashboard: same service, checks and confirmation email as the app. */
export async function bookAction(_prev: BookState, fd: FormData): Promise<BookState> {
  const owner = await requireOwner();
  const store = await getLeadStore();
  if (!store) return { error: "The database isn't reachable right now.", canOverride: false };

  const dollars = Number(String(fd.get("price") ?? "").replace(/[$,\s]/g, ""));
  const mode = fd.get("mode") === "new" ? "new" : "existing";
  const raw = {
    requestId: str(fd, "requestId"),
    customer:
      mode === "existing"
        ? str(fd, "leadId")
          ? { leadId: str(fd, "leadId") }
          : undefined
        : {
            new: {
              firstName: str(fd, "firstName"),
              lastName: str(fd, "lastName"),
              email: str(fd, "email"),
              phone: str(fd, "phone"),
              serviceAddress: str(fd, "serviceAddress"),
              city: str(fd, "city"),
              zip: str(fd, "zip"),
              vehicleYear: str(fd, "vehicleYear"),
              vehicleMake: str(fd, "vehicleMake"),
              vehicleModel: str(fd, "vehicleModel"),
            },
          },
    serviceId: str(fd, "serviceId"),
    date: str(fd, "date"),
    time: str(fd, "time"),
    durationMinutes: str(fd, "durationMinutes"),
    priceCents: Number.isFinite(dollars) ? Math.round(dollars * 100) : -1,
    notes: str(fd, "notes"),
    override: fd.get("override") === "on",
    sendConfirmation: fd.get("sendConfirmation") === "on",
  };
  if (!raw.customer) return { error: "Choose a customer, or switch to New customer.", canOverride: false };
  const parsed = createAppointmentSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Some details need fixing.", canOverride: false };

  let result;
  try {
    result = await bookFromApp(store, owner.email, parsed.data);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, canOverride: err.fields?.override === OVERRIDABLE };
    throw err;
  }
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  const email =
    result.confirmation === "sent" ? " Confirmation emailed." : result.confirmation === "failed" ? ` The confirmation email didn't send: ${result.confirmationError}` : "";
  redirect(`/admin/jobs/${result.appointment.id}?ok=${encodeURIComponent(`${result.alreadyBooked ? "Already booked." : "Booked."}${email}`)}`);
}