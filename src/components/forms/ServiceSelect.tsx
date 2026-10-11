import { business, getService } from "@/config/business";
import { formatServicePrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { Select } from "./primitives";

/**
 * Every package in one drop-down, grouped (one group today).
 * `showPrices={false}` for forms that appear on the home page, which shows no prices.
 */
export function ServiceSelect({
  placeholder = "Choose a package",
  showPrices = true,
  ...props
}: React.ComponentProps<typeof Select> & { placeholder?: string; showPrices?: boolean }) {
  return (
    <Select {...props}>
      <option value="">{placeholder}</option>
      {business.packageGroups.map((g) => (
        <optgroup key={g.id} label={g.title}>
          {business.services
            .filter((s) => s.group === g.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {showPrices ? `${s.name} · from ${formatServicePrice(s)}` : s.name}
              </option>
            ))}
        </optgroup>
      ))}
    </Select>
  );
}

/** What the chosen package gives, in a few lines. Renders nothing until a package is picked. */
export function ServiceIncludes({ serviceId, className }: { serviceId: string; className?: string }) {
  const s = getService(serviceId);
  if (!s) return null;
  const base = s.includesEverythingIn ? getService(s.includesEverythingIn) : null;
  return (
    <div className={cn("border border-line bg-white rounded-sm px-5 py-4", className)} aria-live="polite">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-apex-deep font-semibold">
        {base ? `Everything in ${base.name}, plus:` : (s.includesHeading ?? "What's included")}
      </p>
      <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
        {(s.summary ?? s.includes).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
