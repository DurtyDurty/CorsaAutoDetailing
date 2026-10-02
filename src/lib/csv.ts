/**
 * CSV output hardened against spreadsheet formula injection. Any cell that
 * starts with a formula trigger character is prefixed with a single quote so
 * Excel / Sheets treat it as text.
 */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r", "|", "%"];

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = Array.isArray(value)
    ? value.join("; ")
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  if (text.length > 0 && FORMULA_TRIGGERS.includes(text[0])) {
    text = `'${text}`;
  }
  // Also neutralise formula-ish content after leading whitespace.
  if (/^\s+[=+\-@]/.test(text)) text = `'${text}`;
  // Semicolons and tabs are quoted too: some spreadsheet locales split cells on them.
  const needsQuotes = /[",;\t\r\n]/.test(text);
  const escaped = text.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}
