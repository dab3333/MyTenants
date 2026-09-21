"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "../../ConfirmModal";
import { Modal } from "../../Modal";
import { MoreIcon } from "../../icons";

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

export function FloorMenu({ floorId, label }: { floorId: string; label: string }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [labelValue, setLabelValue] = useState(label);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    setError(null);

    try {
      const res = await fetch(`/api/floors/${floorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: labelValue }),
      });
      if (res.ok) {
        setEditOpen(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to update floor");
      }
    } catch {
      setError("Failed to update floor");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/floors/${floorId}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteOpen(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error ?? "Failed to delete floor");
      }
    } catch {
      setDeleteError("Failed to delete floor");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Floor options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
      >
        <MoreIcon />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setLabelValue(label);
              setEditOpen(true);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Edit
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
            Delete
          </button>
        </div>
      )}

      <ConfirmModal
        open={deleteOpen}
        title="Delete Floor"
        message={`Delete floor "${label}"? This can't be undone.`}
        confirmLabel="Delete"
        destructive
        isSubmitting={isDeleting}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteOpen(false)}
      />

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Floor">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Floor label</span>
            <input
              className={FIELD}
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              autoFocus
              required
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="rounded bg-clay-600 px-4 py-1.5 font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-clay-300"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Floor"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
