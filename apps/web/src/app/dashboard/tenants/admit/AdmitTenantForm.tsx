"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AvailableRoom } from "@/lib/availableRooms";

type Prospect = { id: string; firstName: string; lastName: string };

export function AdmitTenantForm({
  availableRooms,
  prospects,
}: {
  availableRooms: AvailableRoom[];
  prospects: Prospect[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [roomId, setRoomId] = useState(availableRooms[0]?.roomId ?? "");
  const [prospectId, setProspectId] = useState(prospects[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("0");
  const [depositAmount, setDepositAmount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const tenant = mode === "existing" ? { id: prospectId } : { firstName, lastName };

      const res = await fetch(`/api/rooms/${roomId}/tenancies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant,
          startDate,
          monthlyRate: Number(monthlyRate),
          depositAmount: Number(depositAmount),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/tenants/${data.tenant.id}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to admit tenant");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <fieldset>
        <legend className="text-sm font-medium">Tenant</legend>
        <label className="block text-sm">
          <input type="radio" name="mode" checked={mode === "new"} onChange={() => setMode("new")} /> New tenant
        </label>
        <label className="block text-sm">
          <input type="radio" name="mode" checked={mode === "existing"} onChange={() => setMode("existing")} /> Existing prospect
        </label>
      </fieldset>

      {mode === "new" ? (
        <>
          <label className="block text-sm">
            First name
            <input className="border rounded px-2 py-1 block" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </label>
          <label className="block text-sm">
            Last name
            <input className="border rounded px-2 py-1 block" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
        </>
      ) : (
        <label className="block text-sm">
          Prospect
          <select className="border rounded px-2 py-1 block" value={prospectId} onChange={(e) => setProspectId(e.target.value)} required>
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-sm">
        Room
        <select className="border rounded px-2 py-1 block" value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
          {availableRooms.map((room) => (
            <option key={room.roomId} value={room.roomId}>
              {room.buildingName} / {room.floorLabel} / {room.roomName} ({room.occupied}/{room.capacity})
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Start date
        <input type="date" className="border rounded px-2 py-1 block" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
      </label>
      <label className="block text-sm">
        Monthly rate
        <input type="number" min={0} className="border rounded px-2 py-1 block" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} required />
      </label>
      <label className="block text-sm">
        Deposit amount
        <input type="number" min={0} className="border rounded px-2 py-1 block" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} required />
      </label>

      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-black text-white rounded px-3 py-1" disabled={isSubmitting}>
        {isSubmitting ? "Admitting..." : "Admit Tenant"}
      </button>
    </form>
  );
}
