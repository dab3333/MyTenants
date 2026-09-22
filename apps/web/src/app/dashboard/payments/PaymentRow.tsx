"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

const DOT_CLASSES: Record<string, string> = {
  PENDING: "bg-clay-300",
  PARTIAL: "bg-clay-300",
  PAID: "bg-clay-600",
  OVERDUE: "bg-red-500",
};

const STATUS_TEXT_CLASSES: Record<string, string> = {
  PENDING: "text-clay-700",
  PARTIAL: "text-clay-700",
  PAID: "text-zinc-900",
  OVERDUE: "text-red-700 font-semibold",
};

const AMOUNT_CLASSES: Record<string, string> = {
  PENDING: "text-zinc-900 font-semibold",
  PARTIAL: "text-zinc-900 font-semibold",
  PAID: "text-zinc-400",
  OVERDUE: "text-red-700 font-semibold",
};

export function PaymentRow({
  invoiceId,
  tenantName,
  roomLabel,
  dueDate,
  amountLabel,
  status,
}: {
  invoiceId: string;
  tenantName: string;
  roomLabel: string;
  dueDate: string;
  amountLabel: string;
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
      <td className={`px-5 py-3 ${AMOUNT_CLASSES[status]}`}>{amountLabel}</td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOT_CLASSES[status]}`} />
          <span data-testid="invoice-status" className={`text-sm font-medium ${STATUS_TEXT_CLASSES[status]}`}>
            {status}
          </span>
        </div>
      </td>
    </tr>
  );
}
