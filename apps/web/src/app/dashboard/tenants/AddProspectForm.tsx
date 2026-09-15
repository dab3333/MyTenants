"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "../icons";

const FIELD =
  "block rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

export function AddProspectForm({ onDone }: { onDone: () => void }) {
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
        router.refresh();
        onDone();
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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium text-zinc-700">
        <span className="mb-1 block">First name</span>
        <input
          className={FIELD}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          autoFocus
          required
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        <span className="mb-1 block">Last name</span>
        <input className={FIELD} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
      </label>
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded bg-clay-600 px-4 py-1.5 font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-clay-300"
        disabled={isSubmitting}
      >
        <PlusIcon />
        {isSubmitting ? "Adding…" : "Add Prospect"}
      </button>
      <button
        type="button"
        onClick={onDone}
        className="px-2 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700"
      >
        Cancel
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
