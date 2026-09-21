"use client";

import { useEffect, useRef } from "react";

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  isSubmitting = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onCancel={onCancel}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      className="modal-panel w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-lg backdrop:bg-zinc-900/40"
    >
      {open && (
        <>
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          <p className="mt-2 text-sm text-zinc-600">{message}</p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className={`rounded px-4 py-1.5 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed ${
                destructive
                  ? "bg-red-700 hover:bg-red-800 focus-visible:ring-red-500 disabled:bg-red-300"
                  : "bg-clay-600 hover:bg-clay-700 focus-visible:ring-clay-500 disabled:bg-clay-300"
              }`}
            >
              {isSubmitting ? "Working..." : confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
