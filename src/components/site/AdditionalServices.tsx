import { business } from "@/config/business";
import { formatUsdRange } from "@/lib/pricing";

/** Add-on services priced as ranges. Confirmed at inspection and only done with the customer's approval. */
export function AdditionalServices() {
  return (
    <div>
      <ul className="grid gap-px border border-line bg-line sm:grid-cols-2">
        {business.additionalServices.map((a) => (
          <li
            key={a.id}
            className="group flex items-baseline justify-between gap-4 bg-white px-5 py-4 transition-colors hover:bg-chalk"
          >
            <span className="flex items-baseline gap-3">
              <span aria-hidden="true" className="h-2 w-2 -skew-x-[20deg] bg-apex-deep transition-transform group-hover:scale-125" />
              <span className="font-medium">{a.name}</span>
            </span>
            <span className="shrink-0 font-display text-2xl">{formatUsdRange(a.priceMin, a.priceMax)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-muted">
        Priced after we see the vehicle, and only added with your approval. Not offered yet:{" "}
        {business.futureServices.join(", ")}.
      </p>
    </div>
  );
}
