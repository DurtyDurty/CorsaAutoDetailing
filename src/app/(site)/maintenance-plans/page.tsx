import { permanentRedirect } from "next/navigation";

/** Old maintenance-plan links (and the ads' sitelink) land on the Corsa Club section (2026-10-28). */
export default function MaintenancePlansPage() {
  permanentRedirect("/#corsa-club");
}
