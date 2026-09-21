import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";
import { CONTENT_TYPE_BY_EXTENSION, UPLOAD_DIR } from "@/lib/tenantPhoto";

const FILENAME_PATTERN = /^([a-z0-9]+)-\d+\.(jpg|png|webp)$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;
  const { filename } = await params;

  const match = FILENAME_PATTERN.exec(filename);
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [, tenantId, extension] = match;

  // Org-scoped: only serve the photo if the requesting session's org actually owns this tenant.
  const scoped = createScopedClient(session.organizationId);
  const tenant = await scoped.tenant.findFirst({ where: { id: tenantId } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const buffer = await readFile(path.join(UPLOAD_DIR, filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPE_BY_EXTENSION[extension.toLowerCase()] ?? "application/octet-stream",
        // Filenames are unique per upload (tenantId-timestamp), so a hit is immutable forever.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
