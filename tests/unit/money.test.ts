import { describe, expect, it } from "vitest";
import { computeBalance, formatCents, type BalanceInput } from "@shared/money";

const base: BalanceInput = {
  quotedPriceCents: 29900,
  discountCents: 0,
  depositCents: null,
  depositStatus: "none",
  completedRevenueCents: null,
  payments: [],
};

describe("computeBalance", () => {
  it("owes the full price when nothing is paid", () => {
    expect(computeBalance(base)).toMatchObject({ totalCents: 29900, collectedCents: 0, balanceDueCents: 29900, paidInFull: false });
  });

  it("applies a discount before anything else", () => {
    expect(computeBalance({ ...base, discountCents: 4900 })).toMatchObject({ totalCents: 25000, balanceDueCents: 25000 });
    // A discount bigger than the price can't make the total negative.
    expect(computeBalance({ ...base, discountCents: 99999 }).totalCents).toBe(0);
  });

  it("counts a paid online deposit, and a kept (forfeited) one", () => {
    expect(computeBalance({ ...base, depositCents: 5000, depositStatus: "paid" })).toMatchObject({
      depositPaidCents: 5000,
      collectedCents: 5000,
      balanceDueCents: 24900,
    });
    expect(computeBalance({ ...base, depositCents: 5000, depositStatus: "forfeited" }).collectedCents).toBe(5000);
  });

  it("ignores a deposit that was never paid or was released", () => {
    expect(computeBalance({ ...base, depositCents: 5000, depositStatus: "pending" }).collectedCents).toBe(0);
    expect(computeBalance({ ...base, depositCents: 5000, depositStatus: "released" }).collectedCents).toBe(0);
  });

  it("shows a refunded online deposit as refunded, not as money collected", () => {
    const b = computeBalance({ ...base, depositCents: 5000, depositStatus: "refunded" });
    expect(b).toMatchObject({ depositPaidCents: 0, refundedCents: 5000, collectedCents: 0, balanceDueCents: 29900 });
  });

  it("adds deposit and balance payments and subtracts refunds", () => {
    const b = computeBalance({
      ...base,
      payments: [
        { kind: "deposit", amountCents: 5000 },
        { kind: "balance", amountCents: 24900 },
      ],
    });
    expect(b).toMatchObject({ collectedCents: 29900, balanceDueCents: 0, paidInFull: true });
    const refunded = computeBalance({
      ...base,
      payments: [
        { kind: "balance", amountCents: 29900 },
        { kind: "refund", amountCents: 2000 },
      ],
    });
    expect(refunded).toMatchObject({ collectedCents: 27900, refundedCents: 2000, balanceDueCents: 2000 });
  });

  it("never shows a negative balance when the customer overpays (tip)", () => {
    expect(computeBalance({ ...base, payments: [{ kind: "balance", amountCents: 35000 }] }).balanceDueCents).toBe(0);
  });

  it("reads jobs completed before the ledger existed from the amount typed at completion", () => {
    expect(computeBalance({ ...base, completedRevenueCents: 27500 })).toMatchObject({ collectedCents: 27500, balanceDueCents: 2400 });
  });
});

describe("formatCents", () => {
  it("drops cents on whole dollars and keeps them otherwise", () => {
    expect(formatCents(17900)).toBe("$179");
    expect(formatCents(17950)).toBe("$179.50");
    expect(formatCents(0)).toBe("$0");
  });
});
