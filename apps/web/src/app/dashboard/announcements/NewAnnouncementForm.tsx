"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BuildingOption = { id: string; name: string };
type RoomOption = { id: string; name: string; floor: { label: string; building: { name: string } } };
type TenantOption = { id: string; firstName: string; lastName: string };

const SCOPES = ["ALL", "BUILDING", "ROOM", "TENANT"] as const;

export function NewAnnouncementForm({
  buildings,
  rooms,
  tenants,
}: {
  buildings: BuildingOption[];
  rooms: RoomOption[];
  tenants: TenantOption[];
}) {
  const router = useRouter();
  const [scope, setScope] = useState<(typeof SCOPES)[number]>("ALL");
  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          buildingId: scope === "BUILDING" ? buildingId : undefined,
          roomId: scope === "ROOM" ? roomId : undefined,
          tenantId: scope === "TENANT" ? tenantId : undefined,
          subject,
          body,
        }),
      });

      if (res.ok) {
        setSubject("");
        setBody("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to send announcement");
      }
    } catch {
      setError("Failed to send announcement");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <label className="block text-sm">
        Scope
        <select
          className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block"
          value={scope}
          onChange={(e) => setScope(e.target.value as (typeof SCOPES)[number])}
        >
          <option value="ALL">All tenants</option>
          <option value="BUILDING">One building</option>
          <option value="ROOM">One room</option>
          <option value="TENANT">One tenant</option>
        </select>
      </label>

      {scope === "BUILDING" && (
        <label className="block text-sm">
          Building
          <select className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block" value={buildingId} onChange={(e) => setBuildingId(e.target.value)} required>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {scope === "ROOM" && (
        <label className="block text-sm">
          Room
          <select className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block" value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.floor.building.name} / {room.floor.label} / {room.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {scope === "TENANT" && (
        <label className="block text-sm">
          Tenant
          <select className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.firstName} {tenant.lastName}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-sm">
        Subject
        <input className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block w-full" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </label>
      <label className="block text-sm">
        Body
        <textarea className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block w-full" value={body} onChange={(e) => setBody(e.target.value)} required />
      </label>

      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <button type="submit" className="bg-clay-600 text-white rounded px-3 py-1.5 font-medium hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:bg-clay-300 disabled:cursor-not-allowed transition-colors" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send Announcement"}
      </button>
    </form>
  );
}
