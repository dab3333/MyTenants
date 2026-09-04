"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EndTenancyButton({ tenancyId }: { tenancyId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!confirm("End this tenancy? This will mark the tenant as moved out.")) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/tenancies/${tenancyId}/end`, { method: "POST" });
    setPending(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to end tenancy");
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={pending} className="bg-red-700 text-white rounded px-3 py-1">
        End Tenancy
      </button>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
