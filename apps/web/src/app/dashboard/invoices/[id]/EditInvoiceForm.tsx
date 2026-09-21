"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

export function EditInvoiceForm({
  invoiceId,
  periodStart,
  periodEnd,
  dueDate,
  amountDue,
}: {
  invoiceId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountDue: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ periodStart, periodEnd, dueDate, amountDue });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          dueDate: form.dueDate,
          amountDue: Number(form.amountDue),
        }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to update invoice");
      }
    } catch {
      setError("Failed to update invoice");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Period start</span>
          <input
            type="date"
            className={FIELD}
            value={form.periodStart}
            onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
            required
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Period end</span>
          <input
            type="date"
            className={FIELD}
            value={form.periodEnd}
            onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
            required
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Due date</span>
          <input
            type="date"
            className={FIELD}
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            required
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Amount due</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={FIELD}
            value={form.amountDue}
            onChange={(e) => setForm({ ...form, amountDue: e.target.value })}
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
        className="rounded bg-clay-600 px-4 py-1.5 font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-clay-300"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving..." : "Save Invoice"}
      </button>
    </form>
  );
}
