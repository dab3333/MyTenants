"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { TenantAvatar } from "./TenantAvatar";

const DOT_CLASSES: Record<string, string> = {
  PROSPECT: "bg-clay-300",
  ACTIVE: "bg-clay-600",
  MOVED_OUT: "border border-zinc-300 bg-white",
};

const TEXT_CLASSES: Record<string, string> = {
  PROSPECT: "text-clay-700",
  ACTIVE: "text-zinc-900",
  MOVED_OUT: "text-zinc-400",
};

export function TenantRow({
  tenantId,
  firstName,
  lastName,
  photoUrl,
  name,
  status,
  statusLabel,
  roomLabel,
  profile,
  contact,
}: {
  tenantId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  name: string;
  status: string;
  statusLabel: string;
  roomLabel: string;
  profile: string;
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
        <div className="flex items-center gap-2">
          <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOT_CLASSES[status]}`} />
          <span className={`text-sm font-medium ${TEXT_CLASSES[status]}`}>{statusLabel}</span>
        </div>
      </td>
      <td className="px-5 py-3 text-zinc-500">{roomLabel}</td>
      <td className="px-5 py-3 text-zinc-500">{profile}</td>
      <td className="px-5 py-3 text-zinc-500">{contact}</td>
    </tr>
  );
}
