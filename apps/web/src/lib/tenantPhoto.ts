import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "tenants");
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function parsePhotoDataUrl(dataUrl: string): { extension: string; buffer: Buffer } | null {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const [, mime, base64] = match;
  const extension = EXTENSION_BY_MIME[mime.toLowerCase()];
  if (!extension) return null;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return null;
  }
  if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES) return null;
  return { extension, buffer };
}

/** Saves a base64 data-URL photo to disk and returns its public URL, or null if the input is invalid. */
export async function saveTenantPhoto(tenantId: string, dataUrl: string): Promise<string | null> {
  const parsed = parsePhotoDataUrl(dataUrl);
  if (!parsed) return null;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${tenantId}-${Date.now()}.${parsed.extension}`;
  await writeFile(path.join(UPLOAD_DIR, filename), parsed.buffer);
  // Served via a route handler, not Next's static /public pipeline: `next start` snapshots
  // the public/ directory at server startup, so files written here at runtime (like this one)
  // 404 until the process restarts. A dynamic route always re-reads the filesystem per request.
  return `/api/tenant-photos/${filename}`;
}

/** Best-effort deletion of a previously-saved photo; ignores a missing file. */
export async function deleteTenantPhoto(photoUrl: string | null | undefined): Promise<void> {
  if (!photoUrl) return;
  const filename = path.basename(photoUrl);
  try {
    await unlink(path.join(UPLOAD_DIR, filename));
  } catch {
    // Nothing to clean up, or the file was already gone — not worth failing the request over.
  }
}
