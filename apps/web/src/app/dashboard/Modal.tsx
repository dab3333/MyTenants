"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "./icons";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
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
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        // A click that lands on the <dialog> element itself (rather than a child)
        // means it hit the backdrop area — treat it as a request to close.
        if (e.target === ref.current) onClose();
      }}
      className="modal-panel w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-lg backdrop:bg-zinc-900/40"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
        >
          <CloseIcon />
        </button>
      </div>
      {open && children}
    </dialog>
  );
}
