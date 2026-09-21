"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay-100 text-sm font-semibold text-clay-700">
          {initials(name)}
        </span>
        <span className="max-w-[10rem] truncate text-sm font-medium text-zinc-700">{name}</span>
      </button>

      {open && (
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="absolute right-0 top-full z-10 mt-1.5 whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 shadow-lg transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          Log out
        </button>
      )}
    </div>
  );
}
