"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddProspectForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      if (res.ok) {
        setFirstName("");
        setLastName("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to add prospect");
      }
    } catch {
      setError("Failed to add prospect");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-6">
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          First name
          <input
            className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Last name
          <input
            className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </label>
      </div>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-clay-600 text-white rounded px-3 py-1.5 font-medium hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:bg-clay-300 disabled:cursor-not-allowed transition-colors" disabled={isSubmitting}>
        {isSubmitting ? "Adding..." : "Add Prospect"}
      </button>
    </form>
  );
}
