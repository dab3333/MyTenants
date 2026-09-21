"use client";

import { useState } from "react";
import { Modal } from "../../Modal";
import { TenantAvatar } from "../TenantAvatar";
import { PhotoPreviewModal } from "../PhotoPreviewModal";
import { EditTenantForm } from "./EditTenantForm";
import { EndTenancyButton } from "./EndTenancyButton";

const STATUS_BADGE: Record<string, string> = {
  PROSPECT: "bg-amber-50 text-amber-700",
  ACTIVE: "bg-green-50 text-green-700",
  MOVED_OUT: "bg-zinc-100 text-zinc-500",
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-zinc-900">{value && value.trim() !== "" ? value : "—"}</p>
    </div>
  );
}

export function TenantProfileCard({
  tenantId,
  firstName,
  lastName,
  status,
  photoUrl,
  email,
  phone,
  emergencyContactName,
  emergencyContactRelationship,
  emergencyContactPhone,
  age,
  gender,
  address,
  occupation,
  currentRoomLabel,
  activeTenancyId,
}: {
  tenantId: string;
  firstName: string;
  lastName: string;
  status: string;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  occupation: string | null;
  currentRoomLabel: string | null;
  activeTenancyId: string | null;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fullName = `${firstName} ${lastName}`;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {photoUrl ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              aria-label="View photo"
              className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-2"
            >
              <TenantAvatar photoUrl={photoUrl} firstName={firstName} lastName={lastName} size="lg" />
            </button>
          ) : (
            <TenantAvatar photoUrl={photoUrl} firstName={firstName} lastName={lastName} size="lg" />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">{fullName}</h1>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
              {status}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-clay-400 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1"
        >
          Edit
        </button>
      </div>

      {currentRoomLabel && (
        <div className="mt-6 border-t border-zinc-100 pt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Current Room</p>
          <p className="mt-1 text-zinc-900">{currentRoomLabel}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-zinc-100 pt-6 sm:grid-cols-2">
        <Field label="Age" value={age !== null ? String(age) : null} />
        <Field label="Gender" value={gender} />
        <Field label="Occupation" value={occupation} />
        <Field label="Address" value={address} />
        <Field label="Email" value={email} />
        <Field label="Phone" value={phone} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-zinc-100 pt-4 sm:grid-cols-3">
        <Field label="Emergency contact name" value={emergencyContactName} />
        <Field label="Relationship" value={emergencyContactRelationship} />
        <Field label="Emergency contact phone" value={emergencyContactPhone} />
      </div>

      {activeTenancyId && (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <EndTenancyButton tenancyId={activeTenancyId} />
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Tenant" size="xl">
        <EditTenantForm
          tenantId={tenantId}
          firstName={firstName}
          lastName={lastName}
          photoUrl={photoUrl}
          email={email}
          phone={phone}
          emergencyContactName={emergencyContactName}
          emergencyContactRelationship={emergencyContactRelationship}
          emergencyContactPhone={emergencyContactPhone}
          age={age}
          gender={gender}
          address={address}
          occupation={occupation}
        />
      </Modal>

      {photoUrl && (
        <PhotoPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          photoUrl={photoUrl}
          name={fullName}
        />
      )}
    </div>
  );
}
