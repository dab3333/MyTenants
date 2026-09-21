"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "../Modal";
import { PlusIcon } from "../icons";

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

export function CreateBuildingForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address }),
      });
      if (res.ok) {
        setName("");
        setAddress("");
        setOpen(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to create building");
      }
    } catch {
      setError("Failed to create building");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded bg-clay-600 px-4 py-1.5 font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1"
      >
        <PlusIcon />
        Add Building
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Building">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Name</span>
            <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Address (optional)</span>
            <input className={FIELD} value={address} onChange={(e) => setAddress(e.target.value)} />
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
            {isSubmitting ? "Saving..." : "Save Building"}
          </button>
        </form>
      </Modal>
    </>
  );
}
