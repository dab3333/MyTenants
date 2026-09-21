"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "../icons";

export function PhotoPreviewModal({
  open,
  onClose,
  photoUrl,
  name,
}: {
  open: boolean;
  onClose: () => void;
  photoUrl: string;
  name: string;
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
        if (e.target === ref.current) onClose();
      }}
      className="modal-panel max-h-[85vh] max-w-[85vw] overflow-hidden rounded-lg bg-transparent p-0 backdrop:bg-zinc-900/70"
    >
      {open && (
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2 top-2 rounded-full bg-zinc-900/60 p-1.5 text-white transition-colors hover:bg-zinc-900/80"
          >
            <CloseIcon />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={name}
            className="block max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
          />
        </div>
      )}
    </dialog>
  );
}
