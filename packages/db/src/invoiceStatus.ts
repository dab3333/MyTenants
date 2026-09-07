import { Prisma } from "@prisma/client";

export type InvoiceStatusValue = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";

export type ComputeInvoiceStatusInput = {
  amountDue: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  dueDate: Date;
  today: Date;
};

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function computeInvoiceStatus({
  amountDue,
  totalPaid,
  dueDate,
  today,
}: ComputeInvoiceStatusInput): InvoiceStatusValue {
  if (totalPaid.greaterThanOrEqualTo(amountDue)) return "PAID";

  const isPastDue = startOfDay(today).getTime() > startOfDay(dueDate).getTime();
  if (isPastDue) return "OVERDUE";

  if (totalPaid.greaterThan(0)) return "PARTIAL";

  return "PENDING";
}
