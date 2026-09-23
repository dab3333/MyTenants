import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { RecordPaymentForm } from "./RecordPaymentForm";
import { EditInvoiceForm } from "./EditInvoiceForm";
import { formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/date";

type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";

const STATUS_DOT: Record<InvoiceStatus, string> = {
  PENDING: "bg-clay-300",
  PARTIAL: "bg-clay-300",
  PAID: "bg-clay-600",
  OVERDUE: "bg-red-500",
};

const STATUS_TEXT: Record<InvoiceStatus, string> = {
  PENDING: "text-clay-700",
  PARTIAL: "text-clay-700",
  PAID: "text-zinc-900",
  OVERDUE: "font-semibold text-red-700",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  PENDING: "Pending",
  PARTIAL: "Partial",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

const CARD = "rounded-lg border border-zinc-200 bg-white p-6 shadow-sm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await auth();
  if (!session?.user?.organizationId) return {};
  const { id } = await params;
  const scoped = createScopedClient(session.user.organizationId);
  const invoice = await scoped.invoice.findFirst({
    where: { id },
    select: { tenancy: { select: { tenant: { select: { firstName: true, lastName: true } } } } },
  });
  return { title: invoice ? `${invoice.tenancy.tenant.firstName} ${invoice.tenancy.tenant.lastName} Invoice` : "Invoice" };
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const scoped = createScopedClient(session.user.organizationId);
  const invoice = await scoped.invoice.findFirst({
    where: { id },
    include: {
      payments: { orderBy: { paidAt: "desc" } },
      tenancy: { include: { tenant: true, room: { include: { floor: { include: { building: true } } } } } },
    },
  });

  if (!invoice) {
    return (
      <main className="p-6">
        <p>Invoice not found.</p>
      </main>
    );
  }

  const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);

  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
          Invoice — {invoice.tenancy.tenant.firstName} {invoice.tenancy.tenant.lastName}
        </h1>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${STATUS_DOT[invoice.status]}`} />
          <span data-testid="invoice-status" className={`text-sm font-medium ${STATUS_TEXT[invoice.status]}`}>
            {STATUS_LABEL[invoice.status]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <div className={CARD}>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Room</dt>
                <dd className="font-medium text-zinc-900">
                  {invoice.tenancy.room.floor.building.name} / {invoice.tenancy.room.floor.label} /{" "}
                  {invoice.tenancy.room.name}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Period</dt>
                <dd className="font-medium text-zinc-900">
                  {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Due</dt>
                <dd className="font-medium text-zinc-900">{formatDate(invoice.dueDate)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Amount due</dt>
                <dd className="font-medium text-zinc-900">{formatCurrency(Number(invoice.amountDue))}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Paid so far</dt>
                <dd className="font-medium text-zinc-900">{formatCurrency(totalPaid)}</dd>
              </div>
            </dl>
          </div>

          <div className={CARD}>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Edit Invoice</h2>
            <EditInvoiceForm
              invoiceId={invoice.id}
              periodStart={invoice.periodStart.toISOString().slice(0, 10)}
              periodEnd={invoice.periodEnd.toISOString().slice(0, 10)}
              dueDate={invoice.dueDate.toISOString().slice(0, 10)}
              amountDue={invoice.amountDue.toString()}
            />
          </div>
        </div>

        <div className={CARD}>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Payments</h2>
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-zinc-500">No payments recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {invoice.payments.map((payment) => (
                <li
                  key={payment.id}
                  data-testid="payment-row"
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-100 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-zinc-900">{formatDate(payment.paidAt)}</span>
                  <span className="text-zinc-500">{formatCurrency(Number(payment.amountPaid))}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    {payment.method}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {invoice.status !== "PAID" && (
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Record payment</p>
              <RecordPaymentForm invoiceId={invoice.id} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
