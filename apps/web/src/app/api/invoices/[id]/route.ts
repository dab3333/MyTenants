import { NextResponse } from "next/server";
import { createScopedClient, Prisma, computeInvoiceStatus } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const existing = await scoped.invoice.findFirst({ where: { id }, include: { payments: true } });
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const data: Prisma.InvoiceUpdateInput = {};

  if (body.periodStart !== undefined) {
    if (typeof body.periodStart !== "string" || Number.isNaN(Date.parse(body.periodStart))) {
      return NextResponse.json({ error: "periodStart must be a valid date" }, { status: 400 });
    }
    data.periodStart = new Date(body.periodStart);
  }
  if (body.periodEnd !== undefined) {
    if (typeof body.periodEnd !== "string" || Number.isNaN(Date.parse(body.periodEnd))) {
      return NextResponse.json({ error: "periodEnd must be a valid date" }, { status: 400 });
    }
    data.periodEnd = new Date(body.periodEnd);
  }
  if (body.dueDate !== undefined) {
    if (typeof body.dueDate !== "string" || Number.isNaN(Date.parse(body.dueDate))) {
      return NextResponse.json({ error: "dueDate must be a valid date" }, { status: 400 });
    }
    data.dueDate = new Date(body.dueDate);
  }
  if (body.amountDue !== undefined) {
    if (typeof body.amountDue !== "number" || !Number.isFinite(body.amountDue) || body.amountDue < 0) {
      return NextResponse.json({ error: "amountDue must be a non-negative number" }, { status: 400 });
    }
    data.amountDue = body.amountDue;
  }
  // `status` is intentionally never read from the body — it is always recomputed below.

  const totalPaid = existing.payments.reduce(
    (sum, payment) => sum.add(payment.amountPaid),
    new Prisma.Decimal(0)
  );
  const nextAmountDue = data.amountDue !== undefined ? new Prisma.Decimal(data.amountDue as number) : existing.amountDue;
  const nextDueDate = (data.dueDate as Date | undefined) ?? existing.dueDate;
  data.status = computeInvoiceStatus({
    amountDue: nextAmountDue,
    totalPaid,
    dueDate: nextDueDate,
    today: new Date(),
  });

  try {
    const invoice = await scoped.invoice.update({ where: { id }, data });
    return NextResponse.json({ invoice });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "An invoice already exists for this tenancy covering this period" },
        { status: 409 }
      );
    }
    throw error;
  }
}
