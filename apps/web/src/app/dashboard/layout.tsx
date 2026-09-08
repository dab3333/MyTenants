import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  return (
    <div>
      <header>
        <span>MyTenants</span>
        <Link href="/dashboard/buildings">Buildings</Link>
        <Link href="/dashboard/tenants">Tenants</Link>
        <Link href="/dashboard/payments">Payments</Link>
        <span>{session?.user?.name}</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
