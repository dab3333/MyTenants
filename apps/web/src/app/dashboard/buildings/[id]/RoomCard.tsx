"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmModal } from "../../ConfirmModal";
import { Modal } from "../../Modal";
import { TenantAvatar } from "../../tenants/TenantAvatar";
import { MoreIcon, UserPlusIcon } from "../../icons";
import type { RoomTenant } from "@/lib/buildingOverview";

const STATUS_DOT: Record<"vacant" | "partial" | "full", string> = {
  vacant: "border border-zinc-300 bg-white",
  partial: "bg-clay-300",
  full: "bg-clay-600",
};

const STATUS_NAME_TEXT: Record<"vacant" | "partial" | "full", string> = {
  vacant: "text-zinc-400",
  partial: "text-zinc-900",
  full: "text-zinc-900",
};

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

function tenantMeta(tenant: RoomTenant): string | null {
  const parts = [tenant.age !== null ? String(tenant.age) : null, tenant.gender].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function RoomCard({
  roomId,
  roomName,
  monthlyRate,
  occupied,
  capacity,
  status,
  tenants,
}: {
  roomId: string;
  roomName: string;
  monthlyRate: string;
  occupied: number;
  capacity: number;
  status: "vacant" | "partial" | "full";
  tenants: RoomTenant[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [nameValue, setNameValue] = useState(roomName);
  const [capacityValue, setCapacityValue] = useState(String(capacity));
  const [monthlyRateValue, setMonthlyRateValue] = useState(monthlyRate);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasFreeCapacity = occupied < capacity;
  const admitHref = hasFreeCapacity ? `/dashboard/tenants/admit?roomId=${roomId}` : "/dashboard/tenants/admit";

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameValue,
          capacity: Number(capacityValue),
          monthlyRate: Number(monthlyRateValue),
        }),
      });
      if (res.ok) {
        setEditOpen(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setEditError(data.error ?? "Failed to update room");
      }
    } catch {
      setEditError("Failed to update room");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteOpen(false);
        setOpen(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error ?? "Failed to delete room");
      }
    } catch {
      setDeleteError("Failed to delete room");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="room-card"
        data-status={status}
        className="min-w-[7rem] rounded-lg border border-zinc-200 bg-white p-3 text-left transition-shadow hover:shadow-md"
      >
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
          <span className={`font-semibold ${STATUS_NAME_TEXT[status]}`}>{roomName}</span>
        </div>
        <div className="mt-0.5 text-sm text-zinc-400">
          {occupied}/{capacity} occupied
        </div>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Room ${roomName}`}
        headerActions={
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Room options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            >
              <MoreIcon />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setNameValue(roomName);
                    setCapacityValue(String(capacity));
                    setMonthlyRateValue(monthlyRate);
                    setEditError(null);
                    setEditOpen(true);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  Edit Room
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteError(null);
                    setDeleteOpen(true);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete Room
                </button>
              </div>
            )}
          </div>
        }
      >
        {tenants.length === 0 ? (
          <p className="text-sm text-zinc-500">No tenants currently in this room.</p>
        ) : (
          <ul className="space-y-1">
            {tenants.map((tenant) => {
              const meta = tenantMeta(tenant);
              return (
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
                    <div>
                      <div className="font-medium text-zinc-900">
                        {tenant.firstName} {tenant.lastName}
                      </div>
                      {meta && <div className="text-xs text-zinc-400">{meta}</div>}
                    </div>
                  </Link>
                </li>
              );
            })}
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

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Room">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Room name</span>
            <input
              className={FIELD}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              autoFocus
              required
              disabled={isSubmitting}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm font-medium text-zinc-700">
              <span className="mb-1 block">Capacity</span>
              <input
                type="number"
                min={1}
                className={FIELD}
                value={capacityValue}
                onChange={(e) => setCapacityValue(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              <span className="mb-1 block">Monthly rate</span>
              <input
                type="number"
                min={0}
                className={FIELD}
                value={monthlyRateValue}
                onChange={(e) => setMonthlyRateValue(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </label>
          </div>
          {editError && (
            <p role="alert" className="text-sm text-red-600">
              {editError}
            </p>
          )}
          <button
            type="submit"
            className="rounded bg-clay-600 px-4 py-1.5 font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-clay-300"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Room"}
          </button>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteOpen}
        title="Delete Room"
        message={`Delete room "${roomName}"? This can't be undone.`}
        confirmLabel="Delete"
        destructive
        isSubmitting={isDeleting}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
