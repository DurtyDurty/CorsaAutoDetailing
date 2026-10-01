import { permanentRedirect } from "next/navigation";

/** Monthly Maintenance is now a package (2026-09-30); old links land on its card. */
export default function MaintenancePlansPage() {
  permanentRedirect("/services#monthly-maintenance");
}
