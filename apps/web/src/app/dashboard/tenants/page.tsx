import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { TenantFilters } from "./TenantFilters";
import { TenantRow } from "./TenantRow";
import { TenantsHeader } from "./TenantsHeader";

export const metadata: Metadata = { title: "Tenants" };

export default async function TenantsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; buildingId?: string; roomId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const { status, search, buildingId, roomId } = await searchParams;
  const TENANT_STATUSES = ["PROSPECT", "ACTIVE", "MOVED_OUT"] as const;
  const validStatus = status && (TENANT_STATUSES as readonly string[]).includes(status) ? status : undefined;

  const scoped = createScopedClient(session.user.organizationId);

  const roomFilter = roomId
    ? { roomId }
    : buildingId
      ? { room: { floor: { buildingId } } }
      : {};

  const [tenants, buildings, rooms] = await Promise.all([
    scoped.tenant.findMany({
      where: {
        ...(validStatus ? { status: validStatus as (typeof TENANT_STATUSES)[number] } : {}),
        ...(buildingId || roomId ? { tenancies: { some: { status: "ACTIVE", ...roomFilter } } } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        tenancies: {
          where: { status: "ACTIVE" },
          take: 1,
          include: { room: { include: { floor: { include: { building: true } } } } },
        },
      },
    }),
    scoped.building.findMany({ orderBy: { name: "asc" } }),
    scoped.room.findMany({ orderBy: { name: "asc" }, include: { floor: { include: { building: true } } } }),
  ]);

  const buildingOptions = buildings.map((building) => ({ id: building.id, label: building.name }));
  const roomOptions = rooms.map((room) => ({
    id: room.id,
    label: `${room.floor.building.name} / ${room.floor.label} / ${room.name}`,
  }));

  const STATUS_BADGE: Record<string, string> = {
    PROSPECT: "bg-amber-50 text-amber-700",
    ACTIVE: "bg-green-50 text-green-700",
    MOVED_OUT: "bg-zinc-100 text-zinc-500",
  };
  const STATUS_LABEL: Record<string, string> = {
    PROSPECT: "Prospect",
    ACTIVE: "Active",
    MOVED_OUT: "Moved out",
  };

  return (
    <main className="p-6">
      <TenantsHeader />

      <TenantFilters
        search={search ?? ""}
        status={status ?? ""}
        buildingId={buildingId ?? ""}
        roomId={roomId ?? ""}
        buildings={buildingOptions}
        rooms={roomOptions}
      />
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th scope="col" className="px-5 py-3 font-medium">
                Name
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Room
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Age
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Gender
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Contact
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {tenants.map((tenant) => {
              const room = tenant.tenancies[0]?.room;
              return (
                <TenantRow
                  key={tenant.id}
                  tenantId={tenant.id}
                  firstName={tenant.firstName}
                  lastName={tenant.lastName}
                  photoUrl={tenant.photoUrl}
                  name={`${tenant.firstName} ${tenant.lastName}`}
                  statusBadgeClass={STATUS_BADGE[tenant.status]}
                  statusLabel={STATUS_LABEL[tenant.status]}
                  roomLabel={room ? `${room.floor.building.name} / ${room.floor.label} / ${room.name}` : "—"}
                  age={tenant.age !== null ? String(tenant.age) : "—"}
                  gender={tenant.gender ?? "—"}
                  contact={tenant.phone ?? tenant.email ?? "—"}
                />
              );
            })}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-zinc-500">
                  No tenants found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
