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

  // Up-front ownership check: an invoice outside the caller's organization is a 404
  // regardless of balances, so it does not need the transaction.
  const owned = await scoped.invoice.findFirst({ where: { id: invoiceId }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const amountPaidDecimal = new Prisma.Decimal(amountPaid);

  const result = await scoped.$transaction(async (tx) => {
    // The invoice + payments read and the overpayment guard live INSIDE the transaction:
    // reading the balance outside it let two concurrent requests both see the same
    // totalPaid, both pass the guard, and both insert — overpaying the invoice and
    // writing a status computed without the sibling payment. Reading through `tx` makes
    // the balance check and the insert part of one atomic, isolated unit of work.
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId }, include: { payments: true } });
    if (!invoice) return { notFound: true as const };

    const totalPaid = invoice.payments.reduce(
      (sum, payment) => sum.add(payment.amountPaid),
      new Prisma.Decimal(0)
    );
    const remaining = invoice.amountDue.sub(totalPaid);
    if (amountPaidDecimal.greaterThan(remaining)) {
      return { overpayment: remaining.toString() };
    }

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

  if ("notFound" in result) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if ("overpayment" in result) {
    return NextResponse.json(
      { error: `amountPaid exceeds the invoice's remaining balance of ${result.overpayment}` },
      { status: 409 }
    );
  }

  return NextResponse.json(result, { status: 201 });
}
