"use client";

import { useRef, useState } from "react";
import { TenantAvatar } from "./TenantAvatar";
import { CameraIcon } from "../icons";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;

export function PhotoField({
  photoUrl,
  firstName,
  lastName,
  onChange,
}: {
  photoUrl: string | null;
  firstName: string;
  lastName: string;
  onChange: (dataUrlOrNull: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be smaller than 4MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-4">
      <TenantAvatar photoUrl={photoUrl} firstName={firstName} lastName={lastName} size="lg" />
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-clay-400 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1"
          >
            <CameraIcon />
            {photoUrl ? "Change photo" : "Upload photo"}
          </button>
          {photoUrl && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
