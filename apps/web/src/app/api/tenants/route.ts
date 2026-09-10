import { NextResponse } from "next/server";
import { createScopedClient, Prisma } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

const TENANT_STATUSES = ["PROSPECT", "ACTIVE", "MOVED_OUT"] as const;
type TenantStatus = (typeof TENANT_STATUSES)[number];

export async function GET(request: Request) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const buildingId = searchParams.get("buildingId");
  const roomId = searchParams.get("roomId");
  const search = searchParams.get("search");

  if (statusParam && !TENANT_STATUSES.includes(statusParam as TenantStatus)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const roomFilter = roomId
    ? { roomId }
    : buildingId
      ? { room: { floor: { buildingId } } }
      : {};

  const where: Prisma.TenantWhereInput = {
    ...(statusParam ? { status: statusParam as TenantStatus } : {}),
    ...(buildingId || roomId ? { tenancies: { some: { status: "ACTIVE", ...roomFilter } } } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const scoped = createScopedClient(session.organizationId);
  const tenants = await scoped.tenant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      tenancies: {
        where: { status: "ACTIVE" },
        include: { room: { include: { floor: { include: { building: true } } } } },
      },
    },
  });

  return NextResponse.json({ tenants });
}

export async function POST(request: Request) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.firstName !== "string" || body.firstName.trim() === "") {
    return NextResponse.json({ error: "firstName is required" }, { status: 400 });
  }
  if (typeof body.lastName !== "string" || body.lastName.trim() === "") {
    return NextResponse.json({ error: "lastName is required" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const tenant = await scoped.tenant.create({
    data: {
      organizationId: session.organizationId,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: typeof body.email === "string" && body.email.trim() !== "" ? body.email.trim() : null,
      phone: typeof body.phone === "string" && body.phone.trim() !== "" ? body.phone.trim() : null,
      emergencyContact:
        typeof body.emergencyContact === "string" && body.emergencyContact.trim() !== ""
          ? body.emergencyContact.trim()
          : null,
      status: "PROSPECT",
    },
  });
  return NextResponse.json({ tenant }, { status: 201 });
}
