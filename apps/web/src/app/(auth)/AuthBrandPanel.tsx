"use client";

import { usePathname } from "next/navigation";

const CONTENT: Record<string, { heading: string; description: string }> = {
  "/login": {
    heading: "Run your buildings from one place.",
    description:
      "Tenants, rooms, rent, and payments — organized for landlords who'd rather not touch a spreadsheet again.",
  },
  "/signup": {
    heading: "Set up your organization in minutes.",
    description: "One account for every building, floor, and room you manage.",
  },
};

export function AuthBrandPanel() {
  const pathname = usePathname();
  const content = CONTENT[pathname] ?? CONTENT["/login"];

  return (
    <div className="hidden w-full max-w-md flex-col justify-between bg-clay-600 p-12 lg:flex">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[22%] bg-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 21V10.5L12 3L21 10.5V21H3Z" className="fill-clay-600" />
            <rect x="10" y="15" width="4" height="6" rx="1" fill="white" />
          </svg>
        </div>
        <span className="text-xl font-extrabold text-white">MyTenants</span>
      </div>

      <div key={pathname} className="motion-safe:animate-auth-in">
        <p className="mb-3 text-2xl font-bold leading-snug text-white">{content.heading}</p>
        <p className="text-sm leading-relaxed text-clay-100">{content.description}</p>
      </div>
    </div>
  );
}
