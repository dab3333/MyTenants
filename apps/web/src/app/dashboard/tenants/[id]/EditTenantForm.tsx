"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "../../icons";

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

export function EditTenantForm({
  tenantId,
  firstName,
  lastName,
  email,
  phone,
  emergencyContact,
  age,
  gender,
  address,
  occupation,
}: {
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  emergencyContact: string | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  occupation: string | null;
}) {
  const router = useRouter();
  const [firstNameValue, setFirstNameValue] = useState(firstName);
  const [lastNameValue, setLastNameValue] = useState(lastName);
  const [emailValue, setEmailValue] = useState(email ?? "");
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [emergencyContactValue, setEmergencyContactValue] = useState(emergencyContact ?? "");
  const [ageValue, setAgeValue] = useState(age !== null ? String(age) : "");
  const [genderValue, setGenderValue] = useState(gender ?? "");
  const [addressValue, setAddressValue] = useState(address ?? "");
  const [occupationValue, setOccupationValue] = useState(occupation ?? "");
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
          age: ageValue.trim() === "" ? null : Number(ageValue),
          gender: genderValue,
          address: addressValue,
          occupation: occupationValue,
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
    <div className="max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">Edit Tenant</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-700">
            <span className="mb-1 block">First name</span>
            <input className={FIELD} value={firstNameValue} onChange={(e) => setFirstNameValue(e.target.value)} required />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Last name</span>
            <input className={FIELD} value={lastNameValue} onChange={(e) => setLastNameValue(e.target.value)} required />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Age</span>
            <input type="number" min={0} className={FIELD} value={ageValue} onChange={(e) => setAgeValue(e.target.value)} />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Gender</span>
            <div className="relative">
              <select
                className={`${FIELD} appearance-none pr-8`}
                value={genderValue}
                onChange={(e) => setGenderValue(e.target.value)}
              >
                <option value="">Prefer not to say</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Other">Other</option>
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Occupation</span>
            <input className={FIELD} value={occupationValue} onChange={(e) => setOccupationValue(e.target.value)} />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Address</span>
            <input className={FIELD} value={addressValue} onChange={(e) => setAddressValue(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Email</span>
            <input type="email" className={FIELD} value={emailValue} onChange={(e) => setEmailValue(e.target.value)} />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Phone</span>
            <input className={FIELD} value={phoneValue} onChange={(e) => setPhoneValue(e.target.value)} />
          </label>
        </div>

        <label className="block text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Emergency contact</span>
          <input
            className={FIELD}
            placeholder="Name, relationship, phone number"
            value={emergencyContactValue}
            onChange={(e) => setEmergencyContactValue(e.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="rounded bg-clay-600 px-4 py-1.5 font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-clay-300"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
