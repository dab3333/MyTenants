import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";

const DELIVERY_CLASSES: Record<"SENT" | "FAILED", string> = {
  SENT: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

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
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-2">{notification.subject}</h1>
      <p className="text-zinc-500 text-sm mb-4">
        {notification.scope} — {notification.trigger} — {notification.sentAt.toISOString().slice(0, 10)}
      </p>
      <p className="whitespace-pre-wrap mb-6">{notification.body}</p>

      <h2 className="text-xl font-semibold text-zinc-900 tracking-tight mb-2">Recipients</h2>
      <ul className="space-y-1">
        {notification.recipients.map((recipient) => (
          <li key={recipient.id} data-testid="recipient-row">
            {recipient.tenant.firstName} {recipient.tenant.lastName} — {recipient.recipientEmail ?? "no email"}{" "}
            <span
              data-testid="delivery-status"
              className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${DELIVERY_CLASSES[recipient.deliveryStatus]}`}
            >
              {recipient.deliveryStatus}
            </span>
            {recipient.failureReason && <span className="text-zinc-500 text-xs"> ({recipient.failureReason})</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
