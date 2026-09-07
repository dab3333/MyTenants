import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { getAvailableRooms } from "@/lib/availableRooms";
import { AdmitTenantForm } from "./AdmitTenantForm";

export default async function AdmitTenantPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const scoped = createScopedClient(session.user.organizationId);
  const [availableRooms, prospects] = await Promise.all([
    getAvailableRooms(scoped),
    scoped.tenant.findMany({ where: { status: "PROSPECT" }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Admit Tenant</h1>
      {availableRooms.length === 0 ? (
        <p className="text-gray-500">No rooms with free capacity. Add a building/floor/room first.</p>
      ) : (
        <AdmitTenantForm availableRooms={availableRooms} prospects={prospects} />
      )}
    </main>
  );
}
