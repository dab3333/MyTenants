import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { computeInvoiceStatus } from "../invoiceStatus";

const YESTERDAY = new Date("2026-01-14");
const TODAY = new Date("2026-01-15");
const TOMORROW = new Date("2026-01-16");

describe("computeInvoiceStatus", () => {
  it.each([
    ["fully unpaid, not yet due", "0", "100", TOMORROW, "PENDING"],
    ["partially paid, not yet due", "40", "100", TOMORROW, "PARTIAL"],
    ["fully paid, not yet due", "100", "100", TOMORROW, "PAID"],
    ["overpaid, not yet due", "150", "100", TOMORROW, "PAID"],
    ["fully unpaid, due today", "0", "100", TODAY, "PENDING"],
    ["fully unpaid, past due", "0", "100", YESTERDAY, "OVERDUE"],
    ["partially paid, past due", "40", "100", YESTERDAY, "OVERDUE"],
    ["fully paid, past due", "100", "100", YESTERDAY, "PAID"],
  ])("%s -> %s", (_label, totalPaid, amountDue, dueDate, expected) => {
    const result = computeInvoiceStatus({
      amountDue: new Prisma.Decimal(amountDue),
      totalPaid: new Prisma.Decimal(totalPaid),
      dueDate,
      today: TODAY,
    });
    expect(result).toBe(expected);
  });

  it("compares dates by calendar day, ignoring time-of-day", () => {
    const result = computeInvoiceStatus({
      amountDue: new Prisma.Decimal("100"),
      totalPaid: new Prisma.Decimal("0"),
      dueDate: new Date("2026-01-15T23:59:59"),
      today: new Date("2026-01-15T00:00:01"),
    });
    expect(result).toBe("PENDING");
  });
});
