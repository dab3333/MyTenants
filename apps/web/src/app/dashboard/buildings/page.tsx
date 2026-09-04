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
      <h1 className="text-2xl font-semibold mb-4">Buildings</h1>
      <CreateBuildingForm />
      <ul className="space-y-2">
        {buildings.map((building) => (
          <li key={building.id}>
            <Link className="text-blue-700 underline" href={`/dashboard/buildings/${building.id}`}>
              {building.name}
            </Link>
          </li>
        ))}
        {buildings.length === 0 && <li className="text-gray-500">No buildings yet.</li>}
      </ul>
    </main>
  );
}
