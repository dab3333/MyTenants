import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { NewInvoiceForm } from "./NewInvoiceForm";
import { TenantProfileCard } from "./TenantProfileCard";
import { formatCurrency } from "@/lib/currency";

const TENANCY_STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  ENDED: "bg-zinc-100 text-zinc-500",
};

const INVOICE_STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  PAID: "bg-green-50 text-green-700",
  OVERDUE: "bg-red-50 text-red-700",
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
              <ul className="space-y-6">
                {tenant.tenancies.map((tenancy) => (
                  <li
                    key={tenancy.id}
                    data-testid="tenancy-row"
                    className="rounded-lg border border-zinc-100 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-zinc-900">
                        {tenancy.room.floor.building.name} / {tenancy.room.floor.label} / {tenancy.room.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${TENANCY_STATUS_BADGE[tenancy.status]}`}
                      >
                        {tenancy.status}
                      </span>
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
                                {invoice.periodStart.toISOString().slice(0, 10)} – {invoice.periodEnd.toISOString().slice(0, 10)}
                              </Link>
                              <span className="flex items-center gap-2 text-zinc-500">
                                {formatCurrency(totalPaid)} / {formatCurrency(Number(invoice.amountDue))}
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_BADGE[invoice.status]}`}
                                >
                                  {invoice.status}
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
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>
    </main>
  );
}
