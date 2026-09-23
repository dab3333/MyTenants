import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { NewInvoiceForm } from "./NewInvoiceForm";
import { TenantProfileCard } from "./TenantProfileCard";
import { formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/date";

const TENANCY_DOT: Record<string, string> = {
  ACTIVE: "bg-clay-600",
  ENDED: "border border-zinc-300 bg-white",
};

const TENANCY_TEXT: Record<string, string> = {
  ACTIVE: "text-zinc-900",
  ENDED: "text-zinc-400",
};

const TENANCY_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  ENDED: "Ended",
};

const INVOICE_DOT: Record<string, string> = {
  PENDING: "bg-clay-300",
  PARTIAL: "bg-clay-300",
  PAID: "bg-clay-600",
  OVERDUE: "bg-red-500",
};

const INVOICE_TEXT: Record<string, string> = {
  PENDING: "text-clay-700",
  PARTIAL: "text-clay-700",
  PAID: "text-zinc-900",
  OVERDUE: "font-semibold text-red-700",
};

const INVOICE_LABEL: Record<string, string> = {
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
  const tenant = await scoped.tenant.findFirst({ where: { id }, select: { firstName: true, lastName: true } });
  return { title: tenant ? `${tenant.firstName} ${tenant.lastName}` : "Tenant" };
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const scoped = createScopedClient(session.user.organizationId);
  const tenant = await scoped.tenant.findFirst({
    where: { id },
    include: {
      tenancies: {
        orderBy: { startDate: "desc" },
        include: {
          room: { include: { floor: { include: { building: true } } } },
          invoices: { orderBy: { periodStart: "desc" }, include: { payments: true } },
        },
      },
    },
  });

  if (!tenant) {
    return (
      <main className="p-6">
        <p>Tenant not found.</p>
      </main>
    );
  }

  const activeTenancy = tenant.tenancies.find((t) => t.status === "ACTIVE");
  const currentRoomLabel = activeTenancy
    ? `${activeTenancy.room.floor.building.name} / ${activeTenancy.room.floor.label} / ${activeTenancy.room.name}`
    : null;

  return (
    <main className="p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TenantProfileCard
          tenantId={tenant.id}
          firstName={tenant.firstName}
          lastName={tenant.lastName}
          status={tenant.status}
          photoUrl={tenant.photoUrl}
          email={tenant.email}
          phone={tenant.phone}
          emergencyContactName={tenant.emergencyContactName}
          emergencyContactRelationship={tenant.emergencyContactRelationship}
          emergencyContactPhone={tenant.emergencyContactPhone}
          age={tenant.age}
          gender={tenant.gender}
          address={tenant.address}
          occupation={tenant.occupation}
          currentRoomLabel={currentRoomLabel}
          activeTenancyId={activeTenancy?.id ?? null}
        />

        <div className={CARD}>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Tenancy History</h2>
          {tenant.tenancies.length === 0 ? (
              <p className="text-zinc-500">No tenancy history yet.</p>
            ) : (
              <div>
                {tenant.tenancies.map((tenancy, index) => (
                  <div
                    key={tenancy.id}
                    data-testid="tenancy-row"
                    className={index > 0 ? "mt-6 border-t border-zinc-100 pt-6" : ""}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-zinc-900">
                        {tenancy.room.floor.building.name} / {tenancy.room.floor.label} / {tenancy.room.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${TENANCY_DOT[tenancy.status]}`} />
                        <span className={`text-sm font-medium ${TENANCY_TEXT[tenancy.status]}`}>
                          {TENANCY_LABEL[tenancy.status]}
                        </span>
                      </div>
                    </div>

                    <h3 className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">Invoices</h3>
                    {tenancy.invoices.length === 0 ? (
                      <p className="text-sm text-zinc-500">No invoices yet.</p>
                    ) : (
                      <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {tenancy.invoices.map((invoice) => {
                          const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
                          return (
                            <li
                              key={invoice.id}
                              data-testid="invoice-row"
                              className="flex flex-wrap items-center justify-between gap-2 text-sm"
                            >
                              <Link
                                href={`/dashboard/invoices/${invoice.id}`}
                                className="font-medium text-zinc-900 transition-colors hover:text-clay-700"
                              >
                                {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                              </Link>
                              <span className="flex items-center gap-3 text-zinc-500">
                                {formatCurrency(totalPaid)} / {formatCurrency(Number(invoice.amountDue))}
                                <span className="flex items-center gap-1.5">
                                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${INVOICE_DOT[invoice.status]}`} />
                                  <span className={`text-xs ${INVOICE_TEXT[invoice.status]}`}>
                                    {INVOICE_LABEL[invoice.status]}
                                  </span>
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <div className="mt-4 border-t border-zinc-100 pt-4">
                      <NewInvoiceForm tenancyId={tenancy.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </main>
  );
}
