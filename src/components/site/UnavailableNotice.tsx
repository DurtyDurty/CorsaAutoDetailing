import { reachUsLine } from "@/config/business";

/** Shown in production when durable lead storage is not configured. Fails closed, honestly. */
export function UnavailableNotice() {
  return (
    <div role="status" className="border border-line bg-white rounded-md p-6">
      <h2 className="font-medium text-lg">Online requests are temporarily unavailable</h2>
      <p className="mt-2 text-ink-muted">We can&rsquo;t save requests right now. {reachUsLine()}</p>
    </div>
  );
}
