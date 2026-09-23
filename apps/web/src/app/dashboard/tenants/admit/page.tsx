import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { getAvailableRooms } from "@/lib/availableRooms";
import { AdmitTenantForm } from "./AdmitTenantForm";
import { BuildingMark } from "../../icons";

export const metadata: Metadata = { title: "Admit Tenant" };

export default async function AdmitTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string; prospectId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const { roomId, prospectId } = await searchParams;
  const scoped = createScopedClient(session.user.organizationId);
  const [availableRooms, prospects] = await Promise.all([
    getAvailableRooms(scoped),
    scoped.tenant.findMany({ where: { status: "PROSPECT" }, orderBy: { createdAt: "asc" } }),
  ]);
  const initialRoomId = roomId && availableRooms.some((room) => room.roomId === roomId) ? roomId : undefined;
  const initialProspectId =
    prospectId && prospects.some((p) => p.id === prospectId) ? prospectId : undefined;

  return (
    <main className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 tracking-tight">Admit Tenant</h1>
      {availableRooms.length === 0 ? (
        <div className="flex max-w-2xl flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-200 py-12 text-center">
          <span className="text-zinc-300">
            <BuildingMark />
          </span>
          <p className="text-zinc-500">No rooms with free capacity yet.</p>
          <Link
            href="/dashboard/buildings"
            className="text-sm font-medium text-clay-700 underline decoration-clay-300 underline-offset-2 transition-colors hover:text-clay-800 hover:decoration-clay-500"
          >
            Add a building, floor, or room
          </Link>
        </div>
      ) : (
        <AdmitTenantForm
          availableRooms={availableRooms}
          prospects={prospects}
          initialRoomId={initialRoomId}
          initialProspectId={initialProspectId}
        />
      )}
    </main>
  );
}
