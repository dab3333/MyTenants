"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDownIcon, SearchIcon } from "../icons";

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

type Option = { id: string; label: string };

export function TenantFilters({
  search,
  status,
  buildingId,
  roomId,
  buildings,
  rooms,
}: {
  search: string;
  status: string;
  buildingId: string;
  roomId: string;
  buildings: Option[];
  rooms: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in sync if the URL changes from elsewhere (e.g. back/forward).
  useEffect(() => setSearchValue(search), [search]);

  function navigate(next: { search?: string; status?: string; buildingId?: string; roomId?: string }) {
    const merged = { search, status, buildingId, roomId, ...next };
    const params = new URLSearchParams();
    if (merged.search) params.set("search", merged.search);
    if (merged.status) params.set("status", merged.status);
    if (merged.buildingId) params.set("buildingId", merged.buildingId);
    if (merged.roomId) params.set("roomId", merged.roomId);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ search: value }), 300);
  }

  return (
    <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Search</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
              <SearchIcon />
            </span>
            <input
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name"
              className={`${FIELD} pl-9`}
            />
          </div>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Status</span>
          <div className="relative">
            <select
              value={status}
              onChange={(e) => navigate({ status: e.target.value })}
              className={`${FIELD} appearance-none pr-8`}
            >
              <option value="">All statuses</option>
              <option value="PROSPECT">Prospect</option>
              <option value="ACTIVE">Active</option>
              <option value="MOVED_OUT">Moved out</option>
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Building</span>
          <div className="relative">
            <select
              value={buildingId}
              onChange={(e) => navigate({ buildingId: e.target.value, roomId: "" })}
              className={`${FIELD} appearance-none pr-8`}
            >
              <option value="">All buildings</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.label}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Room</span>
          <div className="relative">
            <select
              value={roomId}
              onChange={(e) => navigate({ roomId: e.target.value })}
              className={`${FIELD} appearance-none pr-8`}
            >
              <option value="">All rooms</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.label}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
        </label>
      </div>
    </div>
  );
}
