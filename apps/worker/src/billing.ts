import { Prisma, PrismaClient, computeInvoiceStatus } from "@mytenants/db";

export type RunDailyBillingResult = { generated: number; recalculated: number };

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function clampedBillingDate(year: number, monthIndex: number, billingDay: number): Date {
  const day = Math.min(billingDay, daysInMonth(year, monthIndex));
  return new Date(Date.UTC(year, monthIndex, day));
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function runDailyBilling(prisma: PrismaClient, today: Date): Promise<RunDailyBillingResult> {
  let generated = 0;
  let recalculated = 0;

  const activeTenancies = await prisma.tenancy.findMany({ where: { status: "ACTIVE" } });

  for (const tenancy of activeTenancies) {
    const billingDate = clampedBillingDate(today.getUTCFullYear(), today.getUTCMonth(), tenancy.billingDay);
    if (!isSameCalendarDay(billingDate, today)) continue;

    const nextBillingDate = clampedBillingDate(today.getUTCFullYear(), today.getUTCMonth() + 1, tenancy.billingDay);
    const periodEnd = new Date(nextBillingDate);
    periodEnd.setUTCDate(periodEnd.getUTCDate() - 1);

    try {
      await prisma.invoice.create({
        data: {
          organizationId: tenancy.organizationId,
          tenancyId: tenancy.id,
          periodStart: billingDate,
          periodEnd,
          amountDue: tenancy.monthlyRate,
          dueDate: billingDate,
          status: "PENDING",
        },
      });
      generated++;
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      // Another run already created this tenancy's invoice for this period — expected, not an error.
    }
  }

  const openInvoices = await prisma.invoice.findMany({
    where: { status: { in: ["PENDING", "PARTIAL"] } },
    include: { payments: true },
  });

  for (const invoice of openInvoices) {
    const totalPaid = invoice.payments.reduce(
      (sum, payment) => sum.add(payment.amountPaid),
      new Prisma.Decimal(0)
    );
    const nextStatus = computeInvoiceStatus({
      amountDue: invoice.amountDue,
      totalPaid,
      dueDate: invoice.dueDate,
      today,
    });
    if (nextStatus !== invoice.status) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: nextStatus } });
      recalculated++;
    }
  }

  return { generated, recalculated };
}
