"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, PlusIcon } from "../../icons";

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "GCASH", "OTHER"] as const;

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Amount paid</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={FIELD}
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Method</span>
          <div className="relative">
            <select
              className={`${FIELD} appearance-none pr-8`}
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
        </label>
      </div>
      <label className="block text-sm font-medium text-zinc-700">
        <span className="mb-1 block">Notes</span>
        <input className={FIELD} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded bg-clay-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-clay-300"
        disabled={isSubmitting}
      >
        <PlusIcon />
        {isSubmitting ? "Recording..." : "Record Payment"}
      </button>
    </form>
  );
}
