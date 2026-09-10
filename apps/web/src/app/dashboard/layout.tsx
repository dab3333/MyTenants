import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

function BuildingMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 21V9L12 3L22 9V21H2Z" fill="currentColor" />
      <rect x="9.5" y="14" width="2.2" height="2.2" fill="white" />
      <rect x="12.8" y="14" width="2.2" height="2.2" fill="white" />
    </svg>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <span className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900">
            <span className="text-clay-600">
              <BuildingMark />
            </span>
            MyTenants
          </span>
          <span className="truncate text-sm text-zinc-500">{session?.user?.name}</span>
        </div>
        <nav className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-zinc-600">
          <Link className="hover:text-clay-700 transition-colors" href="/dashboard">
            Dashboard
          </Link>
          <Link className="hover:text-clay-700 transition-colors" href="/dashboard/buildings">
            Buildings
          </Link>
          <Link className="hover:text-clay-700 transition-colors" href="/dashboard/tenants">
            Tenants
          </Link>
          <Link className="hover:text-clay-700 transition-colors" href="/dashboard/payments">
            Payments
          </Link>
          <Link className="hover:text-clay-700 transition-colors" href="/dashboard/announcements">
            Announcements
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
