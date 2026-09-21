import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.label !== "string" || body.label.trim() === "") {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const existing = await scoped.floor.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Floor not found" }, { status: 404 });

  const floor = await scoped.floor.update({ where: { id }, data: { label: body.label.trim() } });
  return NextResponse.json({ floor });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const scoped = createScopedClient(session.organizationId);
  const existing = await scoped.floor.findFirst({ where: { id }, include: { rooms: true } });
  if (!existing) return NextResponse.json({ error: "Floor not found" }, { status: 404 });
  if (existing.rooms.length > 0) {
    return NextResponse.json({ error: "Remove all rooms from this floor before deleting it" }, { status: 409 });
  }

  await scoped.floor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
