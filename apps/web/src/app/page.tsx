import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">MyTenants</h1>
      <p className="text-zinc-500">Self-hosted property management for landlords and caretakers.</p>
      <Link
        href="/login"
        className="rounded bg-clay-600 px-4 py-2 font-medium text-white transition-colors hover:bg-clay-700"
      >
        Log in
      </Link>
    </main>
  );
}
