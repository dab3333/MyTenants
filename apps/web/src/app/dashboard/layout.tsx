import { auth } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div>
      <header>
        <span>MyTenants</span>
        <span>{session?.user?.name}</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
