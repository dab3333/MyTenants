"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EndTenancyButton({ tenancyId }: { tenancyId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    if (!confirm("End this tenancy? This will mark the tenant as moved out.")) return;
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/tenancies/${tenancyId}/end`, { method: "POST" });
      if (res.ok) {
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
        onClick={handleClick}
        disabled={pending}
        className="rounded bg-red-700 px-3 py-1.5 font-medium text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 disabled:bg-red-300 disabled:cursor-not-allowed"
      >
        {pending ? "Ending..." : "End Tenancy"}
      </button>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
