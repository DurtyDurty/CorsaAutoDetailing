import { business } from "@/config/business";

/** Shown in production when durable lead storage is not configured. Fails closed, honestly. */
export function UnavailableNotice() {
  return (
    <div role="status" className="border border-line bg-white rounded-md p-6">
      <h2 className="font-medium text-lg">Requests are temporarily unavailable</h2>
      <p className="mt-2 text-ink-muted">
        We can&rsquo;t save requests right now. Please check back shortly
        {business.contact.email ? (
          <>
            {" "}
            or email <a href={`mailto:${business.contact.email}`} className="underline underline-offset-4">{business.contact.email}</a>
          </>
        ) : null}
        .
      </p>
    </div>
  );
}
