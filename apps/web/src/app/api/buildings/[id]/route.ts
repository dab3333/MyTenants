import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const scoped = createScopedClient(session.organizationId);
  const building = await scoped.building.findFirst({ where: { id } });
  if (!building) return NextResponse.json({ error: "Building not found" }, { status: 404 });

  return NextResponse.json({ building });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const existing = await scoped.building.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Building not found" }, { status: 404 });

  const data: { name?: string; address?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim() !== "") data.name = body.name.trim();
  if (typeof body.address === "string") data.address = body.address.trim() === "" ? null : body.address.trim();

  const building = await scoped.building.update({ where: { id }, data });
  return NextResponse.json({ building });
}
