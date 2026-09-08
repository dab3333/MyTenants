import { NextResponse } from "next/server";
import { createScopedClient, Prisma, computeInvoiceStatus } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "GCASH", "OTHER"] as const;
type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;
  const { id: invoiceId } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { amountPaid, method, paidAt, notes } = body as Record<string, unknown>;

  if (typeof amountPaid !== "number" || !Number.isFinite(amountPaid) || amountPaid <= 0) {
    return NextResponse.json({ error: "amountPaid must be a positive number" }, { status: 400 });
  }
  if (typeof method !== "string" || !PAYMENT_METHODS.includes(method as PaymentMethodValue)) {
    return NextResponse.json({ error: "method must be one of CASH, BANK_TRANSFER, GCASH, OTHER" }, { status: 400 });
  }
  if (paidAt !== undefined && (typeof paidAt !== "string" || Number.isNaN(Date.parse(paidAt)))) {
    return NextResponse.json({ error: "paidAt must be a valid date" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const invoice = await scoped.invoice.findFirst({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const totalPaid = invoice.payments.reduce(
    (sum, payment) => sum.add(payment.amountPaid),
    new Prisma.Decimal(0)
  );
  const remaining = invoice.amountDue.sub(totalPaid);
  const amountPaidDecimal = new Prisma.Decimal(amountPaid);
  if (amountPaidDecimal.greaterThan(remaining)) {
    return NextResponse.json(
      { error: `amountPaid exceeds the invoice's remaining balance of ${remaining.toString()}` },
      { status: 409 }
    );
  }

  const result = await scoped.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        organizationId: session.organizationId,
        invoiceId: invoice.id,
        amountPaid,
        method: method as PaymentMethodValue,
        paidAt: typeof paidAt === "string" ? new Date(paidAt) : undefined,
        recordedByUserId: session.userId,
        notes: typeof notes === "string" && notes.trim() !== "" ? notes.trim() : null,
      },
    });

    const newTotalPaid = totalPaid.add(amountPaidDecimal);
    const newStatus = computeInvoiceStatus({
      amountDue: invoice.amountDue,
      totalPaid: newTotalPaid,
      dueDate: invoice.dueDate,
      today: new Date(),
    });
    const updatedInvoice = await tx.invoice.update({ where: { id: invoice.id }, data: { status: newStatus } });

    return { payment, invoice: updatedInvoice };
  });

  return NextResponse.json(result, { status: 201 });
}
