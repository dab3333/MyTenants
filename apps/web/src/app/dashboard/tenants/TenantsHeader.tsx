"use client";

import { useState } from "react";
import Link from "next/link";
import { AddProspectForm } from "./AddProspectForm";
import { PlusIcon, UserPlusIcon } from "../icons";

export function TenantsHeader() {
  const [isAddingProspect, setIsAddingProspect] = useState(false);

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Tenants</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddingProspect((v) => !v)}
            aria-expanded={isAddingProspect}
            className="inline-flex items-center gap-2 rounded border border-clay-300 bg-white px-4 py-1.5 font-medium text-clay-700 transition-colors hover:bg-clay-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1"
          >
            <PlusIcon />
            Add Prospect
          </button>
          <Link
            href="/dashboard/tenants/admit"
            className="inline-flex items-center gap-2 rounded bg-clay-600 px-4 py-1.5 font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1"
          >
            <UserPlusIcon />
            Admit Tenant
          </Link>
        </div>
      </div>

      {isAddingProspect && (
        <div className="mt-4 rounded-lg border border-clay-200 bg-clay-50/40 p-4">
          <AddProspectForm onDone={() => setIsAddingProspect(false)} />
        </div>
      )}
    </div>
  );
}
