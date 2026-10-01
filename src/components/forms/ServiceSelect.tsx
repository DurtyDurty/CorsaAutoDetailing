import { business } from "@/config/business";
import { formatServicePrice } from "@/lib/pricing";
import { Select } from "./primitives";

/**
 * Every package in one drop-down, grouped (Popular / Interior / Exterior).
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
