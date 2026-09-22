"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [ownerName, setOwnerName] = useState("");
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
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName, ownerName, email, password }),
      });
      if (res.ok) {
        router.push("/login");
      } else {
        const data = await res.json();
        setError(data.error ?? "Signup failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    "block w-full rounded border border-zinc-300 px-3 py-2 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

  return (
    <div className="w-full max-w-sm motion-safe:animate-auth-in">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900">Create your organization</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Organization name</span>
          <input
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
            className={inputClassName}
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Your name</span>
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            required
            className={inputClassName}
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClassName}
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClassName}
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
          {isSubmitting ? "Creating..." : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link className="text-clay-700 underline decoration-clay-300 underline-offset-2 hover:text-clay-800" href="/login">
          Log in
        </Link>
      </p>
    </div>
  );
}
