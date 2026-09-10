import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { NewAnnouncementForm } from "./NewAnnouncementForm";

const DELIVERY_CLASSES: Record<"SENT" | "FAILED", string> = {
  SENT: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

export default async function AnnouncementsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const scoped = createScopedClient(session.user.organizationId);
  const [buildings, rooms, tenants, notifications] = await Promise.all([
    scoped.building.findMany({ orderBy: { name: "asc" } }),
    scoped.room.findMany({ orderBy: { name: "asc" }, include: { floor: { include: { building: true } } } }),
    scoped.tenant.findMany({ orderBy: { firstName: "asc" } }),
    scoped.notification.findMany({ orderBy: { sentAt: "desc" }, include: { recipients: true } }),
  ]);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-4">Announcements</h1>
      <NewAnnouncementForm buildings={buildings} rooms={rooms} tenants={tenants} />

      <h2 className="text-xl font-semibold text-zinc-900 tracking-tight mt-8 mb-4">History</h2>
      <ul className="space-y-2">
        {notifications.map((notification) => {
          const sentCount = notification.recipients.filter((r) => r.deliveryStatus === "SENT").length;
          const failedCount = notification.recipients.filter((r) => r.deliveryStatus === "FAILED").length;
          return (
            <li key={notification.id} data-testid="notification-row">
              <Link className="text-clay-700 underline decoration-clay-300 underline-offset-2 hover:text-clay-800 hover:decoration-clay-500 transition-colors" href={`/dashboard/announcements/${notification.id}`}>
                {notification.subject}
              </Link>
              <span className="text-zinc-500 text-sm">
                {" "}
                — {notification.scope} — {notification.trigger} — {notification.sentAt.toISOString().slice(0, 10)}{" "}
              </span>
              <span data-testid="notification-delivery-summary" className="text-xs">
                {sentCount} sent
                {failedCount > 0 && (
                  <span className={`ml-1 inline-block rounded px-2 py-0.5 font-medium ${DELIVERY_CLASSES.FAILED}`}>
                    {failedCount} failed
                  </span>
                )}
              </span>
            </li>
          );
        })}
        {notifications.length === 0 && <li className="text-zinc-500">No announcements sent yet.</li>}
      </ul>
    </main>
  );
}
