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
        <label className="block text-sm">
          Floor label
          <input
            className="border rounded px-2 py-1 block"
            placeholder="e.g. 1F"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </label>
      </div>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-black text-white rounded px-3 py-1">
        Add Floor
      </button>
    </form>
  );
}
