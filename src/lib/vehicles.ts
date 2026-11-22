import { getService, getVehicleCategory } from "@/config/business";
import { vehicleText, type ExtraVehicle, type ExtraVehicleSummary } from "@shared/api";

/**
 * Jobs with more than one car (2026-11-22). The first car is the lead's vehicle and the appointment's package;
 * each extra car has its own package and price (`AppointmentRecord.extraVehicles`).
 */

const packageName = (serviceId: string | null) => (serviceId && getService(serviceId)?.name) || null;

export function extraVehicleSummary(v: ExtraVehicle): ExtraVehicleSummary {
  return {
    ...v,
    sizeLabel: v.sizeId ? (getVehicleCategory(v.sizeId)?.label ?? null) : null,
    serviceName: packageName(v.serviceId),
  };
}

/**
 * What the job is, for emails, quotes and lists: "Essential Full Detail" for one car, "Essential Full Detail
 * (2 cars)" when both get the same package, "Essential Full Detail + Signature Full Detail" otherwise.
 */
export function jobServiceName(first: string, extras: readonly ExtraVehicle[]): string {
  if (extras.length === 0) return first;
  const names = [first, ...extras.map((v) => packageName(v.serviceId) ?? "package to choose")];
  return new Set(names).size === 1 ? `${first} (${names.length} cars)` : names.join(" + ");
}

/** The second car in one line for the owner: "2021 Honda Civic (Coupe or sedan): Signature Full Detail, $150". */
export function extraVehicleLine(v: ExtraVehicle, index = 0): string {
  const s = extraVehicleSummary(v);
  const car = vehicleText(v) || `Car ${index + 2}`;
  const pkg = s.serviceName ?? "help choosing a package";
  return `${car}${s.sizeLabel ? ` (${s.sizeLabel})` : ""}: ${pkg}${v.priceCents > 0 ? `, $${Math.round(v.priceCents / 100)}` : ""}`;
}

/**
 * Price lines for a multi-car job, one per car ("Essential Full Detail · 2019 Toyota RAV4"). The first car gets
 * whatever of `totalCents` the extra cars don't account for. A one-car job is one line with the package name.
 */
export function perCarLines(
  firstName: string,
  firstVehicle: { year: number | null; make: string | null; model: string | null },
  extras: readonly ExtraVehicle[],
  totalCents: number,
): { label: string; amountCents: number }[] {
  if (extras.length === 0) return [{ label: firstName, amountCents: totalCents }];
  const extraCents = extras.reduce((s, v) => s + v.priceCents, 0);
  const label = (name: string, car: string) => `${name} · ${car}`.slice(0, 80);
  return [
    { label: label(firstName, vehicleText(firstVehicle) || "Car 1"), amountCents: Math.max(0, totalCents - extraCents) },
    ...extras.map((v, i) => ({ label: label(packageName(v.serviceId) ?? "Detail", vehicleText(v) || `Car ${i + 2}`), amountCents: v.priceCents })),
  ];
}
