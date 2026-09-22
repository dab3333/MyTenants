import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { NewAnnouncementForm } from "./NewAnnouncementForm";
import { NotificationRow } from "./NotificationRow";

export const metadata: Metadata = { title: "Announcements" };

const CARD = "rounded-lg border border-zinc-200 bg-white p-6 shadow-sm";

const SCOPE_LABEL: Record<string, string> = {
  ALL: "All tenants",
  BUILDING: "One building",
  ROOM: "One room",
  TENANT: "One tenant",
};

const TRIGGER_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  AUTO_REMINDER: "Automatic reminder",
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
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 tracking-tight">Announcements</h1>

      <div className={`mb-6 ${CARD}`}>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">Compose</h2>
        <NewAnnouncementForm buildings={buildings} rooms={rooms} tenants={tenants} />
      </div>

      <h2 className="mb-4 text-lg font-semibold text-zinc-900">History</h2>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th scope="col" className="px-5 py-3 font-medium">
                Subject
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Scope
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Trigger
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Sent
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Delivery
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {notifications.map((notification) => {
              const sentCount = notification.recipients.filter((r) => r.deliveryStatus === "SENT").length;
              const failedCount = notification.recipients.filter((r) => r.deliveryStatus === "FAILED").length;
              return (
                <NotificationRow
                  key={notification.id}
                  notificationId={notification.id}
                  subject={notification.subject}
                  scope={SCOPE_LABEL[notification.scope] ?? notification.scope}
                  trigger={TRIGGER_LABEL[notification.trigger] ?? notification.trigger}
                  sentAt={notification.sentAt.toISOString().slice(0, 10)}
                  sentCount={sentCount}
                  failedCount={failedCount}
                />
              );
            })}
            {notifications.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-zinc-500">
                  No announcements sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
