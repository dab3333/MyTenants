import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BuildingMark } from "./icons";
import { NavLinks } from "./NavLinks";
import { PageTransition } from "./PageTransition";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900">
            <span className="text-clay-600">
              <BuildingMark />
            </span>
            MyTenants
          </span>
          <span className="truncate text-sm text-zinc-500">{session?.user?.name}</span>
        </div>
        <NavLinks />
      </header>
      <main>
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
