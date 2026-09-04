import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof body.capacity !== "number" || !Number.isInteger(body.capacity) || body.capacity < 1) {
    return NextResponse.json({ error: "capacity must be a positive integer" }, { status: 400 });
  }
  if (typeof body.monthlyRate !== "number" || body.monthlyRate < 0) {
    return NextResponse.json({ error: "monthlyRate must be a non-negative number" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);

  const floor = await scoped.floor.findFirst({ where: { id } });
  if (!floor) return NextResponse.json({ error: "Floor not found" }, { status: 404 });

  const room = await scoped.room.create({
    data: {
      organizationId: session.organizationId,
      floorId: floor.id,
      name: body.name.trim(),
      capacity: body.capacity,
      monthlyRate: body.monthlyRate,
    },
  });
  return NextResponse.json({ room }, { status: 201 });
}
