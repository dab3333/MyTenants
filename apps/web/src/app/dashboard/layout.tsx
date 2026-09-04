import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
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
