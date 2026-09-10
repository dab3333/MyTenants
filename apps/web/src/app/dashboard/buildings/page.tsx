import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { CreateBuildingForm } from "./CreateBuildingForm";

export default async function BuildingsListPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const scoped = createScopedClient(session.user.organizationId);
  const buildings = await scoped.building.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-6">Buildings</h1>
      <CreateBuildingForm />
      <div className="mt-8 border-t border-zinc-200 pt-6">
        <ul className="space-y-2">
          {buildings.map((building) => (
            <li key={building.id}>
              <Link className="text-clay-700 underline decoration-clay-300 underline-offset-2 hover:text-clay-800 hover:decoration-clay-500 transition-colors" href={`/dashboard/buildings/${building.id}`}>
                {building.name}
              </Link>
            </li>
          ))}
          {buildings.length === 0 && <li className="text-zinc-500">No buildings yet.</li>}
        </ul>
      </div>
    </main>
  );
}
