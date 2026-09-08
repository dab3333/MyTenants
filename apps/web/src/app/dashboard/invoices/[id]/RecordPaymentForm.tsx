"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "GCASH", "OTHER"] as const;

export function RecordPaymentForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [amountPaid, setAmountPaid] = useState("0");
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("CASH");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid: Number(amountPaid), method, notes: notes || undefined }),
      });

      if (res.ok) {
        setAmountPaid("0");
        setNotes("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to record payment");
      }
    } catch {
      setError("Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 max-w-sm mt-2">
      <label className="block text-sm">
        Amount paid
        <input
          type="number"
          min={0}
          step="0.01"
          className="border rounded px-2 py-1 block"
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        Method
        <select
          className="border rounded px-2 py-1 block"
          value={method}
          onChange={(e) => setMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Notes
        <input className="border rounded px-2 py-1 block" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <button type="submit" className="bg-black text-white rounded px-3 py-1" disabled={isSubmitting}>
        {isSubmitting ? "Recording..." : "Record Payment"}
      </button>
    </form>
  );
}
