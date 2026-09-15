"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export function TenantRow({
  tenantId,
  name,
  statusBadgeClass,
  statusLabel,
  roomLabel,
  age,
  gender,
  contact,
}: {
  tenantId: string;
  name: string;
  statusBadgeClass: string;
  statusLabel: string;
  roomLabel: string;
  age: string;
  gender: string;
  contact: string;
}) {
  const router = useRouter();
  const href = `/dashboard/tenants/${tenantId}`;

  return (
    <tr
      data-testid="tenant-row"
      onClick={() => router.push(href)}
      className="cursor-pointer transition-colors hover:bg-zinc-50"
    >
      <td className="px-5 py-3">
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-zinc-900 transition-colors hover:text-clay-700"
        >
          {name}
        </Link>
      </td>
      <td className="px-5 py-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass}`}>{statusLabel}</span>
      </td>
      <td className="px-5 py-3 text-zinc-500">{roomLabel}</td>
      <td className="px-5 py-3 text-zinc-500">{age}</td>
      <td className="px-5 py-3 text-zinc-500">{gender}</td>
      <td className="px-5 py-3 text-zinc-500">{contact}</td>
    </tr>
  );
}
