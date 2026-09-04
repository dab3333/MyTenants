import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function GET() {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const scoped = createScopedClient(session.organizationId);
  const buildings = await scoped.building.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ buildings });
}

export async function POST(request: Request) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const building = await scoped.building.create({
    data: {
      organizationId: session.organizationId,
      name: body.name.trim(),
      address: typeof body.address === "string" && body.address.trim() !== "" ? body.address.trim() : null,
    },
  });
  return NextResponse.json({ building }, { status: 201 });
}
