"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewInvoiceForm({ tenancyId }: { tenancyId: string }) {
  const router = useRouter();
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amountDue, setAmountDue] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tenancies/${tenancyId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStart, periodEnd, dueDate, amountDue: Number(amountDue) }),
      });

      if (res.ok) {
        setPeriodStart("");
        setPeriodEnd("");
        setDueDate("");
        setAmountDue("0");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to create invoice");
      }
    } catch {
      setError("Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 max-w-sm mt-2">
      <label className="block text-sm">
        Period start
        <input type="date" className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
      </label>
      <label className="block text-sm">
        Period end
        <input type="date" className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
      </label>
      <label className="block text-sm">
        Due date
        <input type="date" className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
      </label>
      <label className="block text-sm">
        Amount due
        <input type="number" min={0} step="0.01" className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block" value={amountDue} onChange={(e) => setAmountDue(e.target.value)} required />
      </label>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-clay-600 text-white rounded px-3 py-1.5 font-medium hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:bg-clay-300 disabled:cursor-not-allowed transition-colors" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "New Invoice"}
      </button>
    </form>
  );
}
