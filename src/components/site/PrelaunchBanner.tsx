import { business, isPrelaunch } from "@/config/business";
import { formatEasternDate } from "@/lib/time";

export function PrelaunchBanner() {
  if (!isPrelaunch) return null;
  return (
    <div className="bg-apex-deep text-white text-center font-mono text-[0.72rem] uppercase tracking-[0.12em] px-4 py-2">
      <span className="inline-flex items-center gap-2 font-medium">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
        Preparing to launch
      </span>
      <span className="text-white/85"> · {business.serviceAreas.region} · </span>
      {business.launchDate ? (
        <span className="text-white/85">Opening {formatEasternDate(business.launchDate)}</span>
      ) : (
        <span className="text-white/85">Appointments aren&rsquo;t open yet</span>
      )}
    </div>
  );
}
