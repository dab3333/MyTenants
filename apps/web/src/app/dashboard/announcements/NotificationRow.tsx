"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export function NotificationRow({
  notificationId,
  subject,
  scope,
  trigger,
  sentAt,
  sentCount,
  failedCount,
}: {
  notificationId: string;
  subject: string;
  scope: string;
  trigger: string;
  sentAt: string;
  sentCount: number;
  failedCount: number;
}) {
  const router = useRouter();
  const href = `/dashboard/announcements/${notificationId}`;

  return (
    <tr
      data-testid="notification-row"
      onClick={() => router.push(href)}
      className="cursor-pointer transition-colors hover:bg-zinc-50"
    >
      <td className="px-5 py-3">
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-zinc-900 transition-colors hover:text-clay-700"
        >
          {subject}
        </Link>
      </td>
      <td className="px-5 py-3 text-zinc-500">{scope}</td>
      <td className="px-5 py-3 text-zinc-500">{trigger}</td>
      <td className="px-5 py-3 text-zinc-500">{sentAt}</td>
      <td className="px-5 py-3">
        <span data-testid="notification-delivery-summary" className="inline-flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-sm text-zinc-900">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-clay-600" />
            {sentCount} sent
          </span>
          {failedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-red-500" />
              {failedCount} failed
            </span>
          )}
        </span>
      </td>
    </tr>
  );
}
