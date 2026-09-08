"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <form onSubmit={handleSubmit} className="space-y-2 max-w-sm mt-2">
      <label className="block text-sm">
        Period start
        <input
          type="date"
          className="border rounded px-2 py-1 block"
          value={form.periodStart}
          onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
          required
        />
      </label>
      <label className="block text-sm">
        Period end
        <input
          type="date"
          className="border rounded px-2 py-1 block"
          value={form.periodEnd}
          onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
          required
        />
      </label>
      <label className="block text-sm">
        Due date
        <input
          type="date"
          className="border rounded px-2 py-1 block"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          required
        />
      </label>
      <label className="block text-sm">
        Amount due
        <input
          type="number"
          min={0}
          step="0.01"
          className="border rounded px-2 py-1 block"
          value={form.amountDue}
          onChange={(e) => setForm({ ...form, amountDue: e.target.value })}
          required
        />
      </label>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <button type="submit" className="bg-black text-white rounded px-3 py-1" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save Invoice"}
      </button>
    </form>
  );
}
