import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { EndTenancyButton } from "./EndTenancyButton";

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
        include: { room: { include: { floor: { include: { building: true } } } } },
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
      <h1 className="text-2xl font-semibold">
        {tenant.firstName} {tenant.lastName}
      </h1>
      <p className="text-gray-500 mb-4">{tenant.status}</p>
      {tenant.email && <p>Email: {tenant.email}</p>}
      {tenant.phone && <p>Phone: {tenant.phone}</p>}
      {tenant.emergencyContact && <p>Emergency contact: {tenant.emergencyContact}</p>}

      {activeTenancy && (
        <div className="mt-4">
          <p>
            Currently in {activeTenancy.room.floor.building.name} / {activeTenancy.room.floor.label} / {activeTenancy.room.name}
          </p>
          <EndTenancyButton tenancyId={activeTenancy.id} />
        </div>
      )}

      <h2 className="text-lg font-medium mt-6 mb-2">Tenancy History</h2>
      <ul className="space-y-1">
        {tenant.tenancies.map((tenancy) => (
          <li key={tenancy.id} data-testid="tenancy-row">
            {tenancy.room.floor.building.name} / {tenancy.room.floor.label} / {tenancy.room.name} —{" "}
            {tenancy.status}
          </li>
        ))}
        {tenant.tenancies.length === 0 && <li className="text-gray-500">No tenancy history yet.</li>}
      </ul>
    </main>
  );
}
