"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
  }

  return (
    <main>
      <h1>Create your organization</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Organization name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
        <input placeholder="Your name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Sign up</button>
      </form>
    </main>
  );
}
