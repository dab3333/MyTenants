"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddFloorForm({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/buildings/${buildingId}/floors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (res.ok) {
      setLabel("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add floor");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Floor label
          <input
            className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block"
            placeholder="e.g. 1F"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </label>
      </div>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-clay-600 text-white rounded px-3 py-1.5 font-medium hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:bg-clay-300 disabled:cursor-not-allowed transition-colors">
        Add Floor
      </button>
    </form>
  );
}
