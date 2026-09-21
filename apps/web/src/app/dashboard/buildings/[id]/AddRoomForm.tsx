"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "../../Modal";
import { PlusIcon } from "../../icons";

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

export function AddRoomForm({ floorId }: { floorId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [monthlyRate, setMonthlyRate] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/floors/${floorId}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, capacity: Number(capacity), monthlyRate: Number(monthlyRate) }),
      });
      if (res.ok) {
        setName("");
        setCapacity("1");
        setMonthlyRate("0");
        setOpen(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to add room");
      }
    } catch {
      setError("Failed to add room");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-[7rem] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 p-3 text-zinc-400 transition-colors hover:border-clay-400 hover:text-clay-700"
      >
        <PlusIcon />
        <span className="text-sm font-medium">Add Room</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Room">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Room name</span>
            <input
              className={FIELD}
              value={name}
              onChange={(e) => setName(e.target.value)}
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
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
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
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </label>
          </div>
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
            {isSubmitting ? "Saving..." : "Save Room"}
          </button>
        </form>
      </Modal>
    </>
  );
}
