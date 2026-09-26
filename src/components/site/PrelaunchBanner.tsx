import { business, isPrelaunch } from "@/config/business";
import { formatEasternDate } from "@/lib/time";

export function PrelaunchBanner() {
  if (!isPrelaunch) return null;
  return (
    <div className="bg-charcoal text-ivory text-center text-sm px-4 py-2.5 on-dark">
      <span className="text-champagne font-semibold">Preparing to launch</span>
      <span className="text-ivory/80"> in {business.serviceAreas.region}.</span>{" "}
      {business.launchDate ? (
        <span className="text-ivory/80">Opening {formatEasternDate(business.launchDate)}.</span>
      ) : (
        <span className="text-ivory/80">Appointments aren&rsquo;t open yet.</span>
      )}
    </div>
  );
}
