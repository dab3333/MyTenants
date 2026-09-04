import Link from "next/link";

export default function DashboardHomePage() {
  return (
    <section>
      <h1>Dashboard</h1>
      <p>Buildings, tenants, payments, and notifications will appear here in later releases.</p>
      <p>
        <Link href="/dashboard/buildings">Manage buildings</Link>
      </p>
    </section>
  );
}
