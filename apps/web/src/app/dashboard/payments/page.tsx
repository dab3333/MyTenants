import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { PaymentFilters } from "./PaymentFilters";
import { PaymentRow } from "./PaymentRow";
import { formatCurrency } from "@/lib/currency";

export const metadata: Metadata = { title: "Payments" };

const INVOICE_STATUSES = ["PENDING", "PARTIAL", "PAID", "OVERDUE"] as const;
const PAGE_SIZE = 20;

const STATUS_BADGE: Record<(typeof INVOICE_STATUSES)[number], string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  PAID: "bg-green-50 text-green-700",
  OVERDUE: "bg-red-50 text-red-700",
};

function parseDateParam(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function endOfUTCDay(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const { status, page: pageParam, from, to } = await searchParams;
  const validStatus = status && (INVOICE_STATUSES as readonly string[]).includes(status) ? status : undefined;
  const page = Math.max(1, Number(pageParam) || 1);
  const fromDate = parseDateParam(from);
  const toDate = parseDateParam(to);

  const scoped = createScopedClient(session.user.organizationId);
  const where = {
    ...(validStatus ? { status: validStatus as (typeof INVOICE_STATUSES)[number] } : {}),
    ...(fromDate || toDate
      ? { dueDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: endOfUTCDay(toDate) } : {}) } }
      : {}),
  };

  const [invoices, total] = await Promise.all([
    scoped.invoice.findMany({
      where,
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        payments: true,
        tenancy: { include: { tenant: true, room: { include: { floor: { include: { building: true } } } } } },
      },
    }),
    scoped.invoice.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (targetPage: number) => {
    const params = new URLSearchParams();
    if (validStatus) params.set("status", validStatus);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <main className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 tracking-tight">Payments</h1>

      <PaymentFilters status={status ?? ""} from={from ?? ""} to={to ?? ""} />

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th scope="col" className="px-5 py-3 font-medium">
                Tenant
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Room
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Due
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Amount
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {invoices.map((invoice) => {
              const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
              return (
                <PaymentRow
                  key={invoice.id}
                  invoiceId={invoice.id}
                  tenantName={`${invoice.tenancy.tenant.firstName} ${invoice.tenancy.tenant.lastName}`}
                  roomLabel={`${invoice.tenancy.room.floor.building.name} / ${invoice.tenancy.room.floor.label} / ${invoice.tenancy.room.name}`}
                  dueDate={invoice.dueDate.toISOString().slice(0, 10)}
                  amountLabel={`${formatCurrency(totalPaid)} / ${formatCurrency(Number(invoice.amountDue))}`}
                  statusBadgeClass={STATUS_BADGE[invoice.status]}
                  status={invoice.status}
                />
              );
            })}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-zinc-500">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <p>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={pageLink(page - 1)}
                className="rounded border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition-colors hover:border-clay-400 hover:bg-zinc-50"
              >
                Previous
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded border border-zinc-200 px-3 py-1.5 font-medium text-zinc-300">
                Previous
              </span>
            )}
            <span className="px-2">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={pageLink(page + 1)}
                className="rounded border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition-colors hover:border-clay-400 hover:bg-zinc-50"
              >
                Next
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded border border-zinc-200 px-3 py-1.5 font-medium text-zinc-300">
                Next
              </span>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
