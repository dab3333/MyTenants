import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const existing = await scoped.room.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  if ("capacity" in body && (typeof body.capacity !== "number" || !Number.isInteger(body.capacity) || body.capacity < 1)) {
    return NextResponse.json({ error: "capacity must be a positive integer" }, { status: 400 });
  }
  if ("monthlyRate" in body && (typeof body.monthlyRate !== "number" || body.monthlyRate < 0)) {
    return NextResponse.json({ error: "monthlyRate must be a non-negative number" }, { status: 400 });
  }

  const data: { name?: string; capacity?: number; monthlyRate?: number } = {};
  if (typeof body.name === "string" && body.name.trim() !== "") data.name = body.name.trim();
  if (typeof body.capacity === "number" && Number.isInteger(body.capacity) && body.capacity >= 1) {
    data.capacity = body.capacity;
  }
  if (typeof body.monthlyRate === "number" && body.monthlyRate >= 0) data.monthlyRate = body.monthlyRate;

  const room = await scoped.room.update({ where: { id }, data });
  return NextResponse.json({ room });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const scoped = createScopedClient(session.organizationId);
  const existing = await scoped.room.findFirst({
    where: { id },
    include: { tenancies: { where: { status: "ACTIVE" } } },
  });
  if (!existing) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (existing.tenancies.length > 0) {
    return NextResponse.json(
      { error: "This room has an active tenant. End their tenancy before deleting it." },
      { status: 409 }
    );
  }

  await scoped.room.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
