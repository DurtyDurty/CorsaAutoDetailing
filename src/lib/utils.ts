export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function shortRef(id: string): string {
  return id.replace(/-/g, "").slice(-6).toUpperCase();
}

/** Strip control characters and trim; keep it plain text. */
export function cleanText(value: unknown, max = 2000): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Keep digits only; accept 10-digit US numbers or 11 with leading 1. */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

export function formatPhone(digits: string): string {
  if (digits.length !== 10) return digits;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
