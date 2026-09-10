import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { RecordPaymentForm } from "./RecordPaymentForm";
import { EditInvoiceForm } from "./EditInvoiceForm";

type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";

const STATUS_CLASSES: Record<InvoiceStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
};

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
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
        Invoice — {invoice.tenancy.tenant.firstName} {invoice.tenancy.tenant.lastName}
      </h1>
      <p className="mb-4">
        <span
          data-testid="invoice-status"
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[invoice.status]}`}
        >
          {invoice.status}
        </span>
      </p>
      <p>
        {invoice.tenancy.room.floor.building.name} / {invoice.tenancy.room.floor.label} / {invoice.tenancy.room.name}
      </p>
      <p>
        Period: {invoice.periodStart.toISOString().slice(0, 10)} – {invoice.periodEnd.toISOString().slice(0, 10)}
      </p>
      <p>Due: {invoice.dueDate.toISOString().slice(0, 10)}</p>
      <p>Amount due: {invoice.amountDue.toString()}</p>
      <p>Paid so far: {totalPaid}</p>

      <h2 className="text-lg font-medium text-zinc-900 mt-6 mb-2">Payments</h2>
      <ul className="space-y-1">
        {invoice.payments.map((payment) => (
          <li key={payment.id} data-testid="payment-row">
            {payment.paidAt.toISOString().slice(0, 10)} — {payment.amountPaid.toString()} — {payment.method}
          </li>
        ))}
        {invoice.payments.length === 0 && <li className="text-zinc-500">No payments recorded yet.</li>}
      </ul>

      {invoice.status !== "PAID" && <RecordPaymentForm invoiceId={invoice.id} />}

      <h2 className="text-lg font-medium text-zinc-900 mt-6 mb-2">Edit Invoice</h2>
      <EditInvoiceForm
        invoiceId={invoice.id}
        periodStart={invoice.periodStart.toISOString().slice(0, 10)}
        periodEnd={invoice.periodEnd.toISOString().slice(0, 10)}
        dueDate={invoice.dueDate.toISOString().slice(0, 10)}
        amountDue={invoice.amountDue.toString()}
      />
    </main>
  );
}
