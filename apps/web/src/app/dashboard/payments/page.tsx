import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";

const INVOICE_STATUSES = ["PENDING", "PARTIAL", "PAID", "OVERDUE"] as const;

const STATUS_CLASSES: Record<(typeof INVOICE_STATUSES)[number], string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const { status } = await searchParams;
  const validStatus = status && (INVOICE_STATUSES as readonly string[]).includes(status) ? status : undefined;

  const scoped = createScopedClient(session.user.organizationId);
  const invoices = await scoped.invoice.findMany({
    where: validStatus ? { status: validStatus as (typeof INVOICE_STATUSES)[number] } : {},
    orderBy: { dueDate: "asc" },
    include: {
      payments: true,
      tenancy: { include: { tenant: true, room: { include: { floor: { include: { building: true } } } } } },
    },
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-6">Payments</h1>
      <form className="mb-6 flex flex-wrap gap-2" method="get">
        <label className="block text-sm font-medium text-zinc-700">
          Status
          <select name="status" defaultValue={status ?? ""} className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIAL">Partial</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </label>
        <button type="submit" className="border border-zinc-300 rounded px-3 py-1 font-medium text-zinc-700 hover:bg-zinc-50 hover:border-clay-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 transition-colors">Filter</button>
      </form>
      <ul className="space-y-2">
        {invoices.map((invoice) => {
          const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
          return (
            <li key={invoice.id} data-testid="invoice-row">
              <Link className="text-clay-700 underline decoration-clay-300 underline-offset-2 hover:text-clay-800 hover:decoration-clay-500 transition-colors" href={`/dashboard/invoices/${invoice.id}`}>
                {invoice.tenancy.tenant.firstName} {invoice.tenancy.tenant.lastName} —{" "}
                {invoice.tenancy.room.floor.building.name}/{invoice.tenancy.room.floor.label}/{invoice.tenancy.room.name}
              </Link>
              <span className="text-zinc-500 text-sm">
                {" "}
                — due {invoice.dueDate.toISOString().slice(0, 10)} — {totalPaid}/{invoice.amountDue.toString()}{" "}
              </span>
              <span
                data-testid="invoice-status"
                className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[invoice.status]}`}
              >
                {invoice.status}
              </span>
            </li>
          );
        })}
        {invoices.length === 0 && <li className="text-zinc-500">No invoices found.</li>}
      </ul>
    </main>
  );
}
