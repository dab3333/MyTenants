"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "../../ConfirmModal";

export function EndTenancyButton({ tenancyId }: { tenancyId: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/tenancies/${tenancyId}/end`, { method: "POST" });
      if (res.ok) {
        setConfirmOpen(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to end tenancy");
      }
    } catch {
      setError("Failed to end tenancy");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        className="rounded bg-red-700 px-3 py-1.5 font-medium text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
      >
        End Tenancy
      </button>

      <ConfirmModal
        open={confirmOpen}
        title="End Tenancy"
        message="End this tenancy? This will mark the tenant as moved out."
        confirmLabel="End Tenancy"
        destructive
        isSubmitting={pending}
        error={error}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
