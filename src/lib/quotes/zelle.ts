import "server-only";
import { ZELLE_QR_MODULES } from "./zelle-qr";

/**
 * Where customers send a Zelle payment. Printed on the invoice PDF only (owner decision
 * 2026-10-13): never on the website, quotes or in email text, which is why it lives in a
 * server-only file instead of the public business config. This is the owner's personal
 * account until the business account is open. `null` = the invoice has no Zelle section.
 */
export const ZELLE: { name: string; phone: string; qr: readonly string[] } | null = {
  name: "Herson Sanchez",
  phone: "9047203161",
  qr: ZELLE_QR_MODULES,
};
