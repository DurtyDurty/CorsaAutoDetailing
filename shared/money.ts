/**
 * Price, deposit and balance math in integer cents. Shared by the owner API
 * and the mobile app so both show the same numbers.
 */

export const PAYMENT_KINDS = ["deposit", "balance", "refund"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

/** How the owner collected it. `stripe` is only written by the server (deposits). */
export const PAYMENT_METHODS = ["card_reader", "cash", "digital", "stripe"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card_reader: "Card reader",
  cash: "Cash",
  digital: "Digital (Zelle, Venmo, Cash App…)",
  stripe: "Stripe",
};

export interface LedgerEntry {
  kind: PaymentKind;
  amountCents: number;
}

export interface BalanceInput {
  quotedPriceCents: number;
  discountCents: number;
  /** Online deposit tracked on the appointment itself (Stripe). */
  depositCents: number | null;
  depositStatus: string;
  /** Legacy: amount the owner typed when completing a job before the ledger existed. */
  completedRevenueCents: number | null;
  payments: LedgerEntry[];
}

export interface Balance {
  /** Price after discount. */
  totalCents: number;
  depositPaidCents: number;
  collectedCents: number;
  refundedCents: number;
  /** Never negative. */
  balanceDueCents: number;
  paidInFull: boolean;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function computeBalance(i: BalanceInput): Balance {
  const totalCents = Math.max(0, i.quotedPriceCents - Math.max(0, i.discountCents));
  const ledgerDeposits = sum(i.payments.filter((p) => p.kind === "deposit").map((p) => p.amountCents));
  const onlineDeposit = i.depositStatus === "paid" || i.depositStatus === "forfeited" ? (i.depositCents ?? 0) : 0;
  const depositPaidCents = ledgerDeposits + onlineDeposit;
  const balancePayments = sum(i.payments.filter((p) => p.kind === "balance").map((p) => p.amountCents));
  const ledgerRefunds = sum(i.payments.filter((p) => p.kind === "refund").map((p) => p.amountCents));
  // A refunded online deposit was never counted as paid above, so it only shows in the refund total.
  const refundedCents = ledgerRefunds + (i.depositStatus === "refunded" ? (i.depositCents ?? 0) : 0);

  // Before the ledger, completing a job recorded the full amount collected in one number.
  const legacyOnly = i.payments.length === 0 && i.completedRevenueCents !== null;
  const collectedCents = legacyOnly
    ? Math.max(i.completedRevenueCents ?? 0, depositPaidCents)
    : depositPaidCents + balancePayments - ledgerRefunds;

  const balanceDueCents = Math.max(0, totalCents - collectedCents);
  return {
    totalCents,
    depositPaidCents,
    collectedCents: Math.max(0, collectedCents),
    refundedCents,
    balanceDueCents,
    paidInFull: balanceDueCents === 0,
  };
}

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}
