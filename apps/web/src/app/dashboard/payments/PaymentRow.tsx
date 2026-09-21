"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export function PaymentRow({
  invoiceId,
  tenantName,
  roomLabel,
  dueDate,
  amountLabel,
  statusBadgeClass,
  status,
}: {
  invoiceId: string;
  tenantName: string;
  roomLabel: string;
  dueDate: string;
  amountLabel: string;
  statusBadgeClass: string;
  status: string;
}) {
  const router = useRouter();
  const href = `/dashboard/invoices/${invoiceId}`;

  return (
    <tr
      data-testid="invoice-row"
      onClick={() => router.push(href)}
      className="cursor-pointer transition-colors hover:bg-zinc-50"
    >
      <td className="px-5 py-3">
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-zinc-900 transition-colors hover:text-clay-700"
        >
          {tenantName}
        </Link>
      </td>
      <td className="px-5 py-3 text-zinc-500">{roomLabel}</td>
      <td className="px-5 py-3 text-zinc-500">{dueDate}</td>
      <td className="px-5 py-3 text-zinc-500">{amountLabel}</td>
      <td className="px-5 py-3">
        <span data-testid="invoice-status" className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
          {status}
        </span>
      </td>
    </tr>
  );
}
