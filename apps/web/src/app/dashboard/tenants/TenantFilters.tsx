"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDownIcon, SearchIcon } from "../icons";

type Option = { id: string; label: string };

const SEGMENT_SELECT =
  "appearance-none cursor-pointer border-none bg-transparent py-3.5 pl-5 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clay-500";

function segmentTextClass(isSet: boolean): string {
  return isSet
    ? "font-semibold text-zinc-900"
    : "font-medium text-zinc-700 transition-colors hover:text-clay-700";
}

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
    <div className="mb-6 flex flex-wrap items-stretch overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <label className="flex flex-grow items-center gap-2.5 px-5 py-3.5">
        <span className="sr-only">Search</span>
        <span className="text-zinc-400">
          <SearchIcon />
        </span>
        <input
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search tenants by name"
          className="w-full min-w-0 border-none bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none"
        />
      </label>

      <div className="my-2.5 hidden w-px shrink-0 bg-zinc-200 sm:block" />

      <div className="relative">
        <label className="sr-only" htmlFor="tenant-filter-status">
          Status
        </label>
        <select
          id="tenant-filter-status"
          value={status}
          onChange={(e) => navigate({ status: e.target.value })}
          className={`${SEGMENT_SELECT} ${segmentTextClass(status !== "")}`}
        >
          <option value="">Status</option>
          <option value="PROSPECT">Prospect</option>
          <option value="ACTIVE">Active</option>
          <option value="MOVED_OUT">Moved out</option>
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
      </div>

      <div className="my-2.5 hidden w-px shrink-0 bg-zinc-200 sm:block" />

      <div className="relative">
        <label className="sr-only" htmlFor="tenant-filter-building">
          Building
        </label>
        <select
          id="tenant-filter-building"
          value={buildingId}
          onChange={(e) => navigate({ buildingId: e.target.value, roomId: "" })}
          className={`${SEGMENT_SELECT} ${segmentTextClass(buildingId !== "")}`}
        >
          <option value="">Building</option>
          {buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {building.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
      </div>

      <div className="my-2.5 hidden w-px shrink-0 bg-zinc-200 sm:block" />

      <div className="relative">
        <label className="sr-only" htmlFor="tenant-filter-room">
          Room
        </label>
        <select
          id="tenant-filter-room"
          value={roomId}
          onChange={(e) => navigate({ roomId: e.target.value })}
          className={`${SEGMENT_SELECT} ${segmentTextClass(roomId !== "")}`}
        >
          <option value="">Room</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
      </div>
    </div>
  );
}
