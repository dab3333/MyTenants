import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BuildingBadge } from "./icons";
import { NavLinks } from "./NavLinks";
import { PageTransition } from "./PageTransition";
import { UserMenu } from "./UserMenu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex shrink-0 items-center gap-3 text-xl font-extrabold tracking-tight text-zinc-900">
            <BuildingBadge />
            MyTenants
          </span>
          <UserMenu name={session?.user?.name ?? "Account"} />
        </div>
        <NavLinks />
      </header>
      <main>
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
