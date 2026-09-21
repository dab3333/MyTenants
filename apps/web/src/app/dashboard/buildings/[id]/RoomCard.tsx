"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal } from "../../Modal";
import { TenantAvatar } from "../../tenants/TenantAvatar";
import { UserPlusIcon } from "../../icons";
import type { RoomTenant } from "@/lib/buildingOverview";

const STATUS_CLASSES: Record<"vacant" | "partial" | "full", string> = {
  vacant: "bg-zinc-100 text-zinc-600",
  partial: "bg-amber-50 text-amber-700",
  full: "bg-green-50 text-green-700",
};

export function RoomCard({
  roomId,
  roomName,
  occupied,
  capacity,
  status,
  tenants,
}: {
  roomId: string;
  roomName: string;
  occupied: number;
  capacity: number;
  status: "vacant" | "partial" | "full";
  tenants: RoomTenant[];
}) {
  const [open, setOpen] = useState(false);
  const hasFreeCapacity = occupied < capacity;
  const admitHref = hasFreeCapacity ? `/dashboard/tenants/admit?roomId=${roomId}` : "/dashboard/tenants/admit";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="room-card"
        data-status={status}
        className={`min-w-[7rem] rounded-lg border p-3 text-left transition-shadow hover:shadow-md ${STATUS_CLASSES[status]}`}
      >
        <div className="font-semibold">{roomName}</div>
        <div className="text-sm">
          {occupied}/{capacity}
        </div>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Room ${roomName}`}>
        {tenants.length === 0 ? (
          <p className="text-sm text-zinc-500">No tenants currently in this room.</p>
        ) : (
          <ul className="space-y-1">
            {tenants.map((tenant) => (
              <li key={tenant.id}>
                <Link
                  href={`/dashboard/tenants/${tenant.id}`}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-50"
                >
                  <TenantAvatar
                    photoUrl={tenant.photoUrl}
                    firstName={tenant.firstName}
                    lastName={tenant.lastName}
                    size="sm"
                  />
                  <span className="font-medium text-zinc-900">
                    {tenant.firstName} {tenant.lastName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-zinc-100 pt-4">
          <Link
            href={admitHref}
            className="inline-flex items-center gap-2 rounded bg-clay-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1"
          >
            <UserPlusIcon />
            Admit Tenant
          </Link>
        </div>
      </Modal>
    </>
  );
}
