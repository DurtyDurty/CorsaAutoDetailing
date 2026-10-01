import { redirect } from "next/navigation";

/** Appointments now live on the Calendar (same layout as the owner app). */
export default function AppointmentsPage() {
  redirect("/admin/calendar");
}
