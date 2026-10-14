import "server-only";
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { business } from "@/config/business";
import { ON_SITE_PRICE } from "@shared/api";
import { formatCents } from "@shared/money";
import { webColors } from "@shared/brand";
import { formatEastern } from "@/lib/time";
import { formatPhone } from "@/lib/utils";
import type { QuoteLine } from "@/lib/leads/types";
import { LOGO_ASPECT, LOGO_LIGHT_PNG_BASE64 } from "./logo";

/**
 * The quote (and the invoice) as a PDF: Letter size, dark header band with the logo, line items,
 * totals, notes and terms. Everything is drawn as text by pdf-lib (no HTML,
 * no fonts or images fetched from anywhere), so customer-typed text can only
 * ever appear as text.
 */

export interface QuoteDocument {
  number: string;
  issuedAt: string;
  expiresAt: string;
  customer: { name: string; email: string; phone: string | null; address: string | null };
  appointment: { startsAt: string; endsAt: string; serviceName: string; vehicle: string | null };
  lines: QuoteLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  notes: string | null;
  /** The customer's private link; omitted on copies that shouldn't carry it. */
  acceptUrl: string | null;
}

/** The bill for a job: same layout as the quote, with what was paid, what is left and how to pay it. */
export interface InvoiceDocument extends Pick<QuoteDocument, "number" | "issuedAt" | "customer" | "appointment" | "lines" | "subtotalCents" | "discountCents" | "totalCents"> {
  /** Money received so far (a refund is negative), oldest first. */
  payments: { label: string; amountCents: number }[];
  balanceDueCents: number;
  /** Shown under "How to pay" while a balance is due. `null` = no Zelle section. */
  zelle: { name: string; phone: string; qr: readonly string[] } | null;
}

type Doc = ({ kind: "quote" } & QuoteDocument) | ({ kind: "invoice" } & InvoiceDocument);

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  band: hex(webColors.asphalt),
  bandText: hex(webColors.chalk),
  bandMuted: hex("#9aa0ab"),
  accent: hex(webColors.apex),
  ink: hex(webColors.ink),
  muted: hex(webColors.inkMuted),
  line: hex(webColors.line),
  wash: hex(webColors.chalk),
};

/** Eastern-time date pieces (formatEastern defaults to date + time, so each style is spelled out). */
const day = (iso: string, dateStyle: "medium" | "long" = "medium") => formatEastern(iso, { dateStyle, timeStyle: undefined });
const longDay = (iso: string) =>
  formatEastern(iso, { dateStyle: undefined, timeStyle: undefined, weekday: "long", month: "long", day: "numeric", year: "numeric" });
const clock = (iso: string) => formatEastern(iso, { dateStyle: undefined, timeStyle: undefined, hour: "numeric", minute: "2-digit" });

const PAGE = { w: 612, h: 792 };
const M = 48; // side margin
const RIGHT = PAGE.w - M;

/** Standard PDF fonts cover Western European text (é, ñ, ’, –). Anything else becomes its plain-letter form or "?". */
function safeText(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());
  const ok = (s: string) => [...s].every((ch) => supported.has(ch.codePointAt(0)!));
  return [...text.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").normalize("NFC")]
    .map((ch) => {
      if (ok(ch)) return ch;
      const plain = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      return plain && ok(plain) ? plain : "?";
    })
    .join("");
}

function wrap(font: PDFFont, size: number, text: string, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      // A single word wider than the column (a long URL or email) is split by characters.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}

export const renderQuotePdf = (q: QuoteDocument) => render({ kind: "quote", ...q });
export const renderInvoicePdf = (i: InvoiceDocument) => render({ kind: "invoice", ...i });

async function render(q: Doc): Promise<Uint8Array> {
  const invoice = q.kind === "invoice" ? q : null;
  const Title = invoice ? "Invoice" : "Quote";
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${Title} ${q.number} - ${business.brand.name}`);
  pdf.setAuthor(business.brand.name);
  pdf.setSubject(`${Title} for ${q.appointment.serviceName}`);
  pdf.setCreator(business.brand.name);
  pdf.setProducer(business.brand.name);
  pdf.setCreationDate(new Date(q.issuedAt));

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(LOGO_LIGHT_PNG_BASE64, "base64"));

  // Assigned by newPage() before anything is drawn.
  let page!: PDFPage;
  let y = 0;
  const pages: PDFPage[] = [];

  const text = (s: string, x: number, at: number, o: { size?: number; font?: PDFFont; color?: RGB; align?: "left" | "right" } = {}) => {
    const font = o.font ?? regular;
    const size = o.size ?? 10;
    const str = safeText(font, s);
    const w = font.widthOfTextAtSize(str, size);
    page.drawText(str, { x: o.align === "right" ? x - w : x, y: at, size, font, color: o.color ?? C.ink });
  };
  const label = (s: string, x: number, at: number, align: "left" | "right" = "left") =>
    text(s.toUpperCase(), x, at, { size: 7.5, font: bold, color: C.muted, align });
  const rule = (at: number, x1 = M, x2 = RIGHT, color = C.line, thickness = 0.75) =>
    page.drawLine({ start: { x: x1, y: at }, end: { x: x2, y: at }, thickness, color });

  const newPage = (first: boolean) => {
    page = pdf.addPage([PAGE.w, PAGE.h]);
    pages.push(page);
    const band = first ? 118 : 56;
    page.drawRectangle({ x: 0, y: PAGE.h - band, width: PAGE.w, height: band, color: C.band });
    page.drawRectangle({ x: 0, y: PAGE.h - band - 4, width: PAGE.w, height: 4, color: C.accent });
    const logoW = first ? 210 : 120;
    page.drawImage(logo, { x: M, y: PAGE.h - band / 2 - logoW / LOGO_ASPECT / 2, width: logoW, height: logoW / LOGO_ASPECT });
    if (first) {
      text(Title.toUpperCase(), RIGHT, PAGE.h - 52, { size: 26, font: bold, color: C.bandText, align: "right" });
      text(`No. ${q.number}`, RIGHT, PAGE.h - 72, { size: 9.5, color: C.bandMuted, align: "right" });
      text(`Issued ${day(q.issuedAt)}`, RIGHT, PAGE.h - 86, { size: 9.5, color: C.bandMuted, align: "right" });
      const status = q.kind === "quote" ? `Valid until ${day(q.expiresAt)}` : q.balanceDueCents > 0 ? `Balance due ${formatCents(q.balanceDueCents)}` : "Paid in full";
      text(status, RIGHT, PAGE.h - 100, { size: 9.5, font: bold, color: C.bandText, align: "right" });
      y = PAGE.h - band - 40;
    } else {
      text(`${Title} ${q.number} (continued)`, RIGHT, PAGE.h - 33, { size: 9.5, color: C.bandMuted, align: "right" });
      y = PAGE.h - band - 32;
    }
  };
  const FOOTER = 64;
  const ensure = (height: number) => {
    if (y - height < FOOTER) newPage(false);
  };

  newPage(true);

  /* ---- Prepared for / Appointment ---- */
  const colW = (RIGHT - M - 32) / 2;
  const leftX = M;
  const rightX = M + colW + 32;
  const top = y;
  label(invoice ? "Billed to" : "Prepared for", leftX, y);
  label(invoice ? "Service" : "Appointment", rightX, y);
  let ly = y - 17;
  let ry = y - 17;
  const left = [
    { s: q.customer.name, bold: true },
    ...(q.customer.address ? wrap(regular, 10, safeText(regular, q.customer.address), colW).map((s) => ({ s, bold: false })) : []),
    { s: q.customer.email, bold: false },
    ...(q.customer.phone ? [{ s: formatPhone(q.customer.phone), bold: false }] : []),
  ];
  for (const l of left) {
    text(l.s, leftX, ly, { size: l.bold ? 12 : 10, font: l.bold ? bold : regular, color: l.bold ? C.ink : C.muted });
    ly -= l.bold ? 16 : 14;
  }
  const right = [
    { s: q.appointment.serviceName, bold: true },
    { s: longDay(q.appointment.startsAt), bold: false },
    {
      s: `${clock(q.appointment.startsAt)} - ${clock(q.appointment.endsAt)} (Eastern)`,
      bold: false,
    },
    ...(q.appointment.vehicle ? [{ s: q.appointment.vehicle, bold: false }] : []),
  ];
  for (const l of right) {
    text(l.s, rightX, ry, { size: l.bold ? 12 : 10, font: l.bold ? bold : regular, color: l.bold ? C.ink : C.muted });
    ry -= l.bold ? 16 : 14;
  }
  y = Math.min(ly, ry, top - 60) - 18;

  /* ---- Line items ---- */
  const amountX = RIGHT - 12;
  const descW = RIGHT - M - 140;
  const tableHead = () => {
    page.drawRectangle({ x: M, y: y - 8, width: RIGHT - M, height: 24, color: C.wash });
    label("Description", M + 12, y);
    label("Amount", amountX, y, "right");
    y -= 30;
  };
  ensure(60);
  tableHead();
  for (const line of q.lines) {
    const rows = wrap(regular, 10.5, safeText(regular, line.label), descW);
    const h = rows.length * 14 + 12;
    if (y - h < FOOTER) {
      newPage(false);
      tableHead();
    }
    rows.forEach((r, i) => text(r, M + 12, y - i * 14, { size: 10.5 }));
    text(line.amountCents === 0 ? ON_SITE_PRICE : formatCents(line.amountCents), amountX, y, { size: 10.5, align: "right", ...(line.amountCents === 0 && { color: C.muted }) });
    y -= rows.length * 14 + 2;
    rule(y + 2);
    y -= 12;
  }

  /* ---- Totals ---- */
  ensure((q.discountCents > 0 ? 100 : 80) + (invoice ? 22 + invoice.payments.length * 18 : 0));
  const totalsX = RIGHT - 220;
  y -= 4;
  text("Subtotal", totalsX, y, { size: 10, color: C.muted });
  text(formatCents(q.subtotalCents), amountX, y, { size: 10, align: "right" });
  y -= 18;
  if (q.discountCents > 0) {
    text("Discount", totalsX, y, { size: 10, color: C.muted });
    text(`-${formatCents(q.discountCents)}`, amountX, y, { size: 10, align: "right" });
    y -= 18;
  }
  if (invoice) {
    // The price, then what has been paid; the box below holds what is left.
    text("Total", totalsX, y, { size: 10, font: bold });
    text(formatCents(q.totalCents), amountX, y, { size: 10, font: bold, align: "right" });
    y -= 18;
    for (const p of invoice.payments) {
      text(p.label, totalsX, y, { size: 10, color: C.muted });
      text(`${p.amountCents > 0 ? "-" : "+"}${formatCents(Math.abs(p.amountCents))}`, amountX, y, { size: 10, align: "right" });
      y -= 18;
    }
  }
  y -= 10;
  page.drawRectangle({ x: totalsX - 12, y: y - 14, width: RIGHT - totalsX + 12, height: 34, color: C.band });
  page.drawRectangle({ x: totalsX - 12, y: y - 14, width: 4, height: 34, color: C.accent });
  text(invoice ? (invoice.balanceDueCents > 0 ? "BALANCE DUE" : "PAID IN FULL") : "TOTAL", totalsX + 2, y - 2, { size: 9, font: bold, color: C.bandMuted });
  text(formatCents(invoice ? invoice.balanceDueCents : q.totalCents), amountX, y - 3, { size: 16, font: bold, color: C.bandText, align: "right" });
  y -= 46;

  /* ---- Notes ---- */
  if (q.kind === "quote" && q.notes) {
    const rows = wrap(regular, 10, safeText(regular, q.notes), RIGHT - M - 28);
    ensure(rows.length * 14 + 40);
    const boxH = rows.length * 14 + 30;
    page.drawRectangle({ x: M, y: y - boxH + 14, width: RIGHT - M, height: boxH, color: C.wash });
    page.drawRectangle({ x: M, y: y - boxH + 14, width: 3, height: boxH, color: C.accent });
    label(`A note from ${business.owner.name.split(" ")[0]}`, M + 14, y);
    rows.forEach((r, i) => text(r, M + 14, y - 16 - i * 14, { size: 10 }));
    y -= boxH + 12;
  }

  /* ---- How to accept ---- */
  if (q.kind === "quote" && q.acceptUrl) {
    ensure(78);
    label("How to accept", M, y);
    text("Accepting confirms your appointment. It takes a minute.", M, y - 16, { size: 10, color: C.muted });
    // A button that opens the quote, with the short address beside it for a printed copy.
    const btnLabel = "REVIEW & ACCEPT ONLINE";
    const btnW = bold.widthOfTextAtSize(btnLabel, 10) + 40;
    const btnTop = y - 26;
    const btnH = 30;
    page.drawRectangle({ x: M, y: btnTop - btnH, width: btnW, height: btnH, color: hex(webColors.apexDeep) });
    text(btnLabel, M + 20, btnTop - 19, { size: 10, font: bold, color: C.bandText });
    const shortUrl = q.acceptUrl.replace(/^https?:\/\//, "");
    text("or visit", M + btnW + 16, btnTop - 12, { size: 8.5, color: C.muted });
    text(shortUrl, M + btnW + 16, btnTop - 25, { size: 10.5, font: bold });
    const linkRight = Math.min(RIGHT, M + btnW + 16 + bold.widthOfTextAtSize(safeText(bold, shortUrl), 10.5));
    const annot = pdf.context.register(
      pdf.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [M, btnTop - btnH, linkRight, btnTop],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(q.acceptUrl) },
      }),
    );
    page.node.set(PDFName.of("Annots"), pdf.context.obj([annot]));
    y = btnTop - btnH - 26;
  }

  /* ---- How to pay (invoice with a balance) ---- */
  if (invoice && invoice.balanceDueCents > 0 && invoice.zelle) {
    const z = invoice.zelle;
    const size = 104;
    ensure(size + 34);
    label("How to pay", M, y);
    const qrTop = y - 12;
    const n = z.qr.length;
    const cell = size / n;
    // Each run of dark modules is one rectangle; a hair of overlap keeps viewers from showing seams.
    z.qr.forEach((row, r) => {
      for (const run of row.matchAll(/1+/g)) {
        page.drawRectangle({ x: M + run.index * cell, y: qrTop - (r + 1) * cell - 0.1, width: run[0].length * cell + 0.1, height: cell + 0.2, color: rgb(0, 0, 0) });
      }
    });
    const tx = M + size + 22;
    text("Pay with Zelle", tx, qrTop - 16, { size: 13, font: bold });
    text("Scan the code in your banking app, or send to:", tx, qrTop - 34, { size: 10, color: C.muted });
    text(formatPhone(z.phone), tx, qrTop - 54, { size: 14, font: bold });
    text(z.name, tx, qrTop - 70, { size: 10, color: C.muted });
    text(`Amount: ${formatCents(invoice.balanceDueCents)}. Cash is welcome too.`, tx, qrTop - 92, { size: 10, color: C.muted });
    y = qrTop - size - 26;
  }

  /* ---- Terms ---- */
  const terms =
    q.kind === "quote"
      ? [
          ...(q.lines.some((l) => l.amountCents === 0)
            ? [`Items marked "${ON_SITE_PRICE}" aren't in the total. We'll price them after we see the car, and only do them with your OK.`]
            : []),
          business.disclosures.inspection,
          `${business.finalQuoteNotice} ${business.taxNotice}`,
          `This quote is valid until ${day(q.expiresAt, "long")}. If weather prevents the service, we'll reschedule at no charge.`,
        ]
      : [`Payment is due when the service is complete. Thank you for choosing ${business.brand.name}.`];
  const termRows = terms.map((t) => wrap(regular, 8, safeText(regular, t), RIGHT - M));
  ensure(termRows.reduce((n, r) => n + r.length * 10.5 + 6, 24));
  label("Terms", M, y);
  y -= 14;
  for (const rows of termRows) {
    for (const r of rows) {
      text(r, M, y, { size: 8, color: C.muted });
      y -= 10.5;
    }
    y -= 6;
  }

  /* ---- Footer on every page ---- */
  const contact = [
    business.brand.name,
    business.owner.veteranOwned ? "Veteran owned" : null,
    business.contact.phone ? formatPhone(business.contact.phone.replace(/\D/g, "")) : null,
    business.contact.email,
    business.brand.canonicalDomain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
  ].filter((s): s is string => Boolean(s));
  pages.forEach((p, i) => {
    page = p;
    rule(46, M, RIGHT, C.line, 0.5);
    text(contact.join("   |   "), M, 32, { size: 8, color: C.muted });
    text(`Page ${i + 1} of ${pages.length}`, RIGHT, 32, { size: 8, color: C.muted, align: "right" });
  });

  return pdf.save();
}
