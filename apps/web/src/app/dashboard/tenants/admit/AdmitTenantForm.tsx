"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AvailableRoom } from "@/lib/availableRooms";
import { ChevronDownIcon, UserPlusIcon } from "../../icons";

type Prospect = { id: string; firstName: string; lastName: string };

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

const SEGMENT_BASE = "rounded-md px-3 py-1.5 text-sm font-medium transition-colors";

export function AdmitTenantForm({
  availableRooms,
  prospects,
}: {
  availableRooms: AvailableRoom[];
  prospects: Prospect[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [roomId, setRoomId] = useState(availableRooms[0]?.roomId ?? "");
  const [prospectId, setProspectId] = useState(prospects[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [occupation, setOccupation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [startDate, setStartDate] = useState("");
  const [billingDay, setBillingDay] = useState("1");
  const [monthlyRate, setMonthlyRate] = useState(availableRooms[0]?.monthlyRate ?? "0");
  const [depositAmount, setDepositAmount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const tenant =
        mode === "existing"
          ? { id: prospectId }
          : {
              firstName,
              lastName,
              age: age.trim() === "" ? null : Number(age),
              gender: gender.trim() === "" ? null : gender,
              address: address.trim() === "" ? null : address,
              occupation: occupation.trim() === "" ? null : occupation,
              email: email.trim() === "" ? null : email,
              phone: phone.trim() === "" ? null : phone,
              emergencyContact: emergencyContact.trim() === "" ? null : emergencyContact,
            };

      const res = await fetch(`/api/rooms/${roomId}/tenancies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant,
          startDate,
          monthlyRate: Number(monthlyRate),
          depositAmount: Number(depositAmount),
          billingDay: Number(billingDay),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/tenants/${data.tenant.id}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to admit tenant");
      }
    } catch {
      setError("Failed to admit tenant");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasProspects = prospects.length > 0;

  return (
    <div className="max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <span className="mb-2 block text-sm font-medium text-zinc-700">Tenant</span>
          <div className="inline-flex rounded-lg border border-zinc-300 p-1">
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`${SEGMENT_BASE} ${mode === "new" ? "bg-clay-600 text-white" : "text-zinc-600 hover:text-zinc-900"}`}
            >
              New tenant
            </button>
            <button
              type="button"
              onClick={() => hasProspects && setMode("existing")}
              disabled={!hasProspects}
              title={hasProspects ? undefined : "No prospects yet"}
              className={`${SEGMENT_BASE} ${mode === "existing" ? "bg-clay-600 text-white" : "text-zinc-600 hover:text-zinc-900"} ${
                hasProspects ? "" : "cursor-not-allowed opacity-40"
              }`}
            >
              Existing prospect
            </button>
          </div>
        </div>

        {mode === "new" ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-zinc-700">
                <span className="mb-1 block">First name</span>
                <input className={FIELD} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                <span className="mb-1 block">Last name</span>
                <input className={FIELD} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </label>
            </div>

            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Profile</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-zinc-700">
                    <span className="mb-1 block">Age</span>
                    <input
                      type="number"
                      min={0}
                      className={FIELD}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                    />
                  </label>
                  <label className="text-sm font-medium text-zinc-700">
                    <span className="mb-1 block">Gender</span>
                    <div className="relative">
                      <select
                        className={`${FIELD} appearance-none pr-8`}
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
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
                    <input className={FIELD} value={occupation} onChange={(e) => setOccupation(e.target.value)} />
                  </label>
                  <label className="text-sm font-medium text-zinc-700">
                    <span className="mb-1 block">Address</span>
                    <input className={FIELD} value={address} onChange={(e) => setAddress(e.target.value)} />
                  </label>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Contact</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-zinc-700">
                    <span className="mb-1 block">Email</span>
                    <input type="email" className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                  <label className="text-sm font-medium text-zinc-700">
                    <span className="mb-1 block">Phone</span>
                    <input className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </label>
                </div>
                <label className="block text-sm font-medium text-zinc-700">
                  <span className="mb-1 block">Emergency contact</span>
                  <input
                    className={FIELD}
                    placeholder="Name, relationship, phone number"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </>
        ) : (
          <label className="block text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Prospect</span>
            <div className="relative">
              <select
                className={`${FIELD} appearance-none pr-8`}
                value={prospectId}
                onChange={(e) => setProspectId(e.target.value)}
                required
              >
                {prospects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            </div>
          </label>
        )}

        <label className="block text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Room</span>
          <div className="relative">
            <select
              className={`${FIELD} appearance-none pr-8`}
              value={roomId}
              onChange={(e) => {
                const nextRoomId = e.target.value;
                setRoomId(nextRoomId);
                const nextRoom = availableRooms.find((room) => room.roomId === nextRoomId);
                if (nextRoom) setMonthlyRate(nextRoom.monthlyRate);
              }}
              required
            >
              {availableRooms.map((room) => (
                <option key={room.roomId} value={room.roomId}>
                  {room.buildingName} / {room.floorLabel} / {room.roomName} ({room.occupied}/{room.capacity})
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Start date</span>
            <input
              type="date"
              className={FIELD}
              value={startDate}
              onChange={(e) => {
                const nextStartDate = e.target.value;
                setStartDate(nextStartDate);
                const dayOfMonth = Number(nextStartDate.split("-")[2]);
                if (Number.isFinite(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31) {
                  setBillingDay(String(dayOfMonth));
                }
              }}
              required
            />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Billing day</span>
            <input
              type="number"
              min={1}
              max={31}
              className={FIELD}
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Monthly rate</span>
            <input
              type="number"
              min={0}
              className={FIELD}
              value={monthlyRate}
              onChange={(e) => setMonthlyRate(e.target.value)}
              required
            />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            <span className="mb-1 block">Deposit amount</span>
            <input
              type="number"
              min={0}
              className={FIELD}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              required
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center gap-4 border-t border-zinc-100 pt-6">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded bg-clay-600 px-4 py-1.5 font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-clay-300"
            disabled={isSubmitting}
          >
            <UserPlusIcon />
            {isSubmitting ? "Admitting…" : "Admit Tenant"}
          </button>
          <Link
            href="/dashboard/tenants"
            className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
