"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { TenantAvatar } from "./TenantAvatar";

export function TenantRow({
  tenantId,
  firstName,
  lastName,
  photoUrl,
  name,
  statusBadgeClass,
  statusLabel,
  roomLabel,
  age,
  gender,
  contact,
}: {
  tenantId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
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
          className="flex items-center gap-3 font-medium text-zinc-900 transition-colors hover:text-clay-700"
        >
          <TenantAvatar photoUrl={photoUrl} firstName={firstName} lastName={lastName} size="sm" />
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
