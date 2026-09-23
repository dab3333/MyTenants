import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { formatDate } from "@/lib/date";

const DELIVERY_DOT: Record<"SENT" | "FAILED", string> = {
  SENT: "bg-clay-600",
  FAILED: "bg-red-500",
};

const DELIVERY_TEXT: Record<"SENT" | "FAILED", string> = {
  SENT: "text-zinc-900",
  FAILED: "font-semibold text-red-700",
};

const DELIVERY_LABEL: Record<"SENT" | "FAILED", string> = {
  SENT: "Sent",
  FAILED: "Failed",
};

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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await auth();
  if (!session?.user?.organizationId) return {};
  const { id } = await params;
  const scoped = createScopedClient(session.user.organizationId);
  const notification = await scoped.notification.findFirst({ where: { id }, select: { subject: true } });
  return { title: notification?.subject ?? "Announcement" };
}

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");
  const { id } = await params;

  const scoped = createScopedClient(session.user.organizationId);
  const notification = await scoped.notification.findFirst({
    where: { id },
    include: { recipients: { include: { tenant: true } } },
  });
  if (!notification) notFound();

  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">{notification.subject}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {SCOPE_LABEL[notification.scope] ?? notification.scope} · {TRIGGER_LABEL[notification.trigger] ?? notification.trigger} ·{" "}
          {formatDate(notification.sentAt)}
        </p>
      </div>

      <div className={`mb-6 ${CARD}`}>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">Message</h2>
        <p className="max-w-prose whitespace-pre-wrap leading-relaxed text-zinc-800">{notification.body}</p>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-zinc-900">Recipients</h2>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th scope="col" className="px-5 py-3 font-medium">
                Tenant
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Email
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {notification.recipients.map((recipient) => (
              <tr key={recipient.id} data-testid="recipient-row">
                <td className="px-5 py-3 font-medium text-zinc-900">
                  {recipient.tenant.firstName} {recipient.tenant.lastName}
                </td>
                <td className="px-5 py-3 text-zinc-500">{recipient.recipientEmail ?? "No email"}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      data-testid="delivery-status"
                      className={`inline-flex items-center gap-1.5 text-sm ${DELIVERY_TEXT[recipient.deliveryStatus]}`}
                    >
                      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${DELIVERY_DOT[recipient.deliveryStatus]}`} />
                      {DELIVERY_LABEL[recipient.deliveryStatus]}
                    </span>
                    {recipient.failureReason && (
                      <span className="text-xs text-zinc-500">{recipient.failureReason}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {notification.recipients.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-zinc-500">
                  No recipients.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
