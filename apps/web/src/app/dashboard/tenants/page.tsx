import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { AddProspectForm } from "./AddProspectForm";

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
    }),
    scoped.building.findMany({ orderBy: { name: "asc" } }),
    scoped.room.findMany({ orderBy: { name: "asc" }, include: { floor: { include: { building: true } } } }),
  ]);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-4">Tenants</h1>
      <Link className="text-clay-700 underline decoration-clay-300 underline-offset-2 hover:text-clay-800 hover:decoration-clay-500 transition-colors mb-4 inline-block" href="/dashboard/tenants/admit">
        Admit Tenant
      </Link>
      <AddProspectForm />
      <form className="mb-4 flex gap-2" method="get">
        <label className="block text-sm">
          Search
          <input name="search" defaultValue={search ?? ""} placeholder="Search by name" className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow" />
        </label>
        <label className="block text-sm">
          Status
          <select name="status" defaultValue={status ?? ""} className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow">
            <option value="">All statuses</option>
            <option value="PROSPECT">Prospect</option>
            <option value="ACTIVE">Active</option>
            <option value="MOVED_OUT">Moved out</option>
          </select>
        </label>
        <label className="block text-sm">
          Building
          <select name="buildingId" defaultValue={buildingId ?? ""} className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow">
            <option value="">All buildings</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Room
          <select name="roomId" defaultValue={roomId ?? ""} className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow">
            <option value="">All rooms</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.floor.building.name} / {room.floor.label} / {room.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="border border-zinc-300 rounded px-3 py-1 font-medium text-zinc-700 hover:bg-zinc-50 hover:border-clay-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 transition-colors">Filter</button>
      </form>
      <ul className="space-y-2">
        {tenants.map((tenant) => (
          <li key={tenant.id} data-testid="tenant-row">
            <Link className="text-clay-700 underline decoration-clay-300 underline-offset-2 hover:text-clay-800 hover:decoration-clay-500 transition-colors" href={`/dashboard/tenants/${tenant.id}`}>
              {tenant.firstName} {tenant.lastName}
            </Link>
            <span className="text-zinc-500 text-sm"> — {tenant.status}</span>
          </li>
        ))}
        {tenants.length === 0 && <li className="text-zinc-500">No tenants found.</li>}
      </ul>
    </main>
  );
}
