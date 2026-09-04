"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddRoomForm({ floorId }: { floorId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [monthlyRate, setMonthlyRate] = useState("0");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/floors/${floorId}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, capacity: Number(capacity), monthlyRate: Number(monthlyRate) }),
    });
    if (res.ok) {
      setName("");
      setCapacity("1");
      setMonthlyRate("0");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to add room");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-4">
      <div>
        <label className="block text-sm">
          Room name
          <input
            className="border rounded px-2 py-1 w-20 block"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <label className="block text-sm">
          Capacity
          <input
            className="border rounded px-2 py-1 w-16 block"
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <label className="block text-sm">
          Monthly rate
          <input
            className="border rounded px-2 py-1 w-24 block"
            type="number"
            min={0}
            value={monthlyRate}
            onChange={(e) => setMonthlyRate(e.target.value)}
            required
          />
        </label>
      </div>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-black text-white rounded px-3 py-1">
        Add Room
      </button>
    </form>
  );
}
