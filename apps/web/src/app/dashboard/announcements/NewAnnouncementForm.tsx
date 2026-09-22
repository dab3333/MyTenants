"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, SendIcon } from "../icons";

type BuildingOption = { id: string; name: string };
type RoomOption = { id: string; name: string; floor: { label: string; building: { name: string } } };
type TenantOption = { id: string; firstName: string; lastName: string };

const SCOPES = ["ALL", "BUILDING", "ROOM", "TENANT"] as const;

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <label className="w-56 text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Scope</span>
          <div className="relative">
            <select
              className={`${FIELD} appearance-none pr-8`}
              value={scope}
              onChange={(e) => setScope(e.target.value as (typeof SCOPES)[number])}
            >
              <option value="ALL">All tenants</option>
              <option value="BUILDING">One building</option>
              <option value="ROOM">One room</option>
              <option value="TENANT">One tenant</option>
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
        </label>

        {scope === "BUILDING" && (
          <label className="w-64 text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Building</span>
            <div className="relative">
              <select
                className={`${FIELD} appearance-none pr-8`}
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                required
              >
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            </div>
          </label>
        )}

        {scope === "ROOM" && (
          <label className="w-64 text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Room</span>
            <div className="relative">
              <select
                className={`${FIELD} appearance-none pr-8`}
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.floor.building.name} / {room.floor.label} / {room.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            </div>
          </label>
        )}

        {scope === "TENANT" && (
          <label className="w-64 text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Tenant</span>
            <div className="relative">
              <select
                className={`${FIELD} appearance-none pr-8`}
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                required
              >
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.firstName} {tenant.lastName}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            </div>
          </label>
        )}
      </div>

      <div className="space-y-4 border-t border-zinc-100 pt-4">
        <label className="block text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Subject</span>
          <input className={FIELD} value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Body</span>
          <textarea
            className={FIELD}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
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
        className="inline-flex items-center gap-2 rounded bg-clay-600 px-4 py-1.5 font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-clay-300"
        disabled={isSubmitting}
      >
        <SendIcon />
        {isSubmitting ? "Sending..." : "Send Announcement"}
      </button>
    </form>
  );
}
