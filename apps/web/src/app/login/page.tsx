"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthBrandPanel } from "../AuthBrandPanel";

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-2 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-stretch justify-center bg-white lg:justify-start">
      <AuthBrandPanel
        heading="Run your buildings from one place."
        description="Tenants, rooms, rent, and payments — organized for landlords who'd rather not touch a spreadsheet again."
      />
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900">Welcome back</h1>
          <p className="mb-6 text-sm text-zinc-500">Log in to your MyTenants account.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-zinc-700">
              <span className="mb-1 block">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={FIELD}
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              <span className="mb-1 block">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={FIELD}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded bg-clay-600 px-3 py-2 font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:bg-clay-300"
            >
              {isSubmitting ? "Logging in..." : "Log in"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-zinc-500">
            New here?{" "}
            <Link className="text-clay-700 underline decoration-clay-300 underline-offset-2 hover:text-clay-800" href="/signup">
              Create an organization
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
