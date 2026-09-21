"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "../../icons";

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

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
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">New invoice</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Period start</span>
          <input type="date" className={FIELD} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Period end</span>
          <input type="date" className={FIELD} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Due date</span>
          <input type="date" className={FIELD} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Amount due</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={FIELD}
            value={amountDue}
            onChange={(e) => setAmountDue(e.target.value)}
            required
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
        className="inline-flex items-center gap-2 rounded bg-clay-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-clay-300"
        disabled={isSubmitting}
      >
        <PlusIcon />
        {isSubmitting ? "Creating..." : "New Invoice"}
      </button>
    </form>
  );
}
