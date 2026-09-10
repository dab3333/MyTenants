"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EditTenantForm({
  tenantId,
  firstName,
  lastName,
  email,
  phone,
  emergencyContact,
}: {
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  emergencyContact: string | null;
}) {
  const router = useRouter();
  const [firstNameValue, setFirstNameValue] = useState(firstName);
  const [lastNameValue, setLastNameValue] = useState(lastName);
  const [emailValue, setEmailValue] = useState(email ?? "");
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [emergencyContactValue, setEmergencyContactValue] = useState(emergencyContact ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstNameValue,
          lastName: lastNameValue,
          email: emailValue,
          phone: phoneValue,
          emergencyContact: emergencyContactValue,
        }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to update tenant");
      }
    } catch {
      setError("Failed to update tenant");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 max-w-sm mt-4">
      <h2 className="text-lg font-medium">Edit Tenant</h2>
      <label className="block text-sm">
        First name
        <input
          className="border rounded px-2 py-1 block"
          value={firstNameValue}
          onChange={(e) => setFirstNameValue(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        Last name
        <input
          className="border rounded px-2 py-1 block"
          value={lastNameValue}
          onChange={(e) => setLastNameValue(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        Email
        <input
          type="email"
          className="border rounded px-2 py-1 block"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Phone
        <input
          className="border rounded px-2 py-1 block"
          value={phoneValue}
          onChange={(e) => setPhoneValue(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Emergency contact
        <input
          className="border rounded px-2 py-1 block"
          value={emergencyContactValue}
          onChange={(e) => setEmergencyContactValue(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <button type="submit" className="bg-black text-white rounded px-3 py-1" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
