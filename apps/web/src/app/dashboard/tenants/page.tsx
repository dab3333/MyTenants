import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { TenantFilters } from "./TenantFilters";
import { TenantRow } from "./TenantRow";
import { TenantsHeader } from "./TenantsHeader";

export const metadata: Metadata = { title: "Tenants" };

const PAGE_SIZE = 20;

export default async function TenantsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; buildingId?: string; roomId?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const { status, search, buildingId, roomId, page: pageParam } = await searchParams;
  const TENANT_STATUSES = ["PROSPECT", "ACTIVE", "MOVED_OUT"] as const;
  const validStatus = status && (TENANT_STATUSES as readonly string[]).includes(status) ? status : undefined;
  const page = Math.max(1, Number(pageParam) || 1);

  const scoped = createScopedClient(session.user.organizationId);

  const roomFilter = roomId
    ? { roomId }
    : buildingId
      ? { room: { floor: { buildingId } } }
      : {};

  const where = {
    ...(validStatus ? { status: validStatus as (typeof TENANT_STATUSES)[number] } : {}),
    ...(buildingId || roomId ? { tenancies: { some: { status: "ACTIVE" as const, ...roomFilter } } } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [tenants, total, buildings, rooms] = await Promise.all([
    scoped.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        tenancies: {
          where: { status: "ACTIVE" },
          take: 1,
          include: { room: { include: { floor: { include: { building: true } } } } },
        },
      },
    }),
    scoped.tenant.count({ where }),
    scoped.building.findMany({ orderBy: { name: "asc" } }),
    scoped.room.findMany({
      where: buildingId ? { floor: { buildingId } } : {},
      orderBy: { name: "asc" },
      include: { floor: { include: { building: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (targetPage: number) => {
    const params = new URLSearchParams();
    if (validStatus) params.set("status", validStatus);
    if (search) params.set("search", search);
    if (buildingId) params.set("buildingId", buildingId);
    if (roomId) params.set("roomId", roomId);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  };

  const buildingOptions = buildings.map((building) => ({ id: building.id, label: building.name }));
  const roomOptions = rooms.map((room) => ({
    id: room.id,
    label: buildingId
      ? `${room.floor.label} / ${room.name}`
      : `${room.floor.building.name} / ${room.floor.label} / ${room.name}`,
  }));

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
                Profile
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Contact
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {tenants.map((tenant) => {
              const room = tenant.tenancies[0]?.room;
              const ageStr = tenant.age !== null ? String(tenant.age) : null;
              const profile = ageStr && tenant.gender ? `${ageStr} · ${tenant.gender}` : ageStr ?? tenant.gender ?? "—";
              return (
                <TenantRow
                  key={tenant.id}
                  tenantId={tenant.id}
                  firstName={tenant.firstName}
                  lastName={tenant.lastName}
                  photoUrl={tenant.photoUrl}
                  name={`${tenant.firstName} ${tenant.lastName}`}
                  status={tenant.status}
                  statusLabel={STATUS_LABEL[tenant.status]}
                  roomLabel={room ? `${room.floor.building.name} / ${room.floor.label} / ${room.name}` : "—"}
                  profile={profile}
                  contact={tenant.phone ?? tenant.email ?? "—"}
                />
              );
            })}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-zinc-500">
                  No tenants found.
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
