import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { EndTenancyButton } from "./EndTenancyButton";
import { NewInvoiceForm } from "./NewInvoiceForm";
import { EditTenantForm } from "./EditTenantForm";

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

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
        {tenant.firstName} {tenant.lastName}
      </h1>
      <p className="text-zinc-500 mb-4">{tenant.status}</p>
      {tenant.email && <p>Email: {tenant.email}</p>}
      {tenant.phone && <p>Phone: {tenant.phone}</p>}
      {tenant.emergencyContact && <p>Emergency contact: {tenant.emergencyContact}</p>}

      <div className="mt-8">
        <EditTenantForm
          tenantId={tenant.id}
          firstName={tenant.firstName}
          lastName={tenant.lastName}
          email={tenant.email}
          phone={tenant.phone}
          emergencyContact={tenant.emergencyContact}
        />
      </div>

      {activeTenancy && (
        <div className="mt-8">
          <p>
            Currently in {activeTenancy.room.floor.building.name} / {activeTenancy.room.floor.label} / {activeTenancy.room.name}
          </p>
          <EndTenancyButton tenancyId={activeTenancy.id} />
        </div>
      )}

      <h2 className="text-lg font-semibold text-zinc-900 mt-8 mb-2">Tenancy History</h2>
      <ul className="space-y-4">
        {tenant.tenancies.map((tenancy) => (
          <li key={tenancy.id} data-testid="tenancy-row">
            <div>
              {tenancy.room.floor.building.name} / {tenancy.room.floor.label} / {tenancy.room.name} —{" "}
              {tenancy.status}
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 mt-2">Invoices</h3>
            <ul className="space-y-1">
              {tenancy.invoices.map((invoice) => {
                const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
                return (
                  <li key={invoice.id} data-testid="invoice-row">
                    <Link className="text-clay-700 underline decoration-clay-300 underline-offset-2 hover:text-clay-800 hover:decoration-clay-500 transition-colors" href={`/dashboard/invoices/${invoice.id}`}>
                      {invoice.periodStart.toISOString().slice(0, 10)} – {invoice.periodEnd.toISOString().slice(0, 10)}
                    </Link>
                    <span className="text-zinc-500 text-sm">
                      {" "}
                      — {totalPaid}/{invoice.amountDue.toString()} — {invoice.status}
                    </span>
                  </li>
                );
              })}
              {tenancy.invoices.length === 0 && <li className="text-zinc-500">No invoices yet.</li>}
            </ul>
            <NewInvoiceForm tenancyId={tenancy.id} />
          </li>
        ))}
        {tenant.tenancies.length === 0 && <li className="text-zinc-500">No tenancy history yet.</li>}
      </ul>
    </main>
  );
}
