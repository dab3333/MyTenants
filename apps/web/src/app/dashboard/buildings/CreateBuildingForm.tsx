"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateBuildingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address }),
    });
    if (res.ok) {
      setName("");
      setAddress("");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create building");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-6">
      <div>
        <label className="block text-sm">
          Name
          <input
            className="border rounded px-2 py-1 block"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <label className="block text-sm">
          Address (optional)
          <input
            className="border rounded px-2 py-1 block"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
      </div>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-black text-white rounded px-3 py-1">
        Add Building
      </button>
    </form>
  );
}
