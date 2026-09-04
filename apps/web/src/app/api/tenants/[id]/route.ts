import { NextResponse } from "next/server";
import { createScopedClient, type Prisma } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;
  const { id } = await params;

  const scoped = createScopedClient(session.organizationId);
  const tenant = await scoped.tenant.findFirst({
    where: { id },
    include: {
      tenancies: {
        orderBy: { startDate: "desc" },
        include: { room: { include: { floor: { include: { building: true } } } } },
      },
    },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  return NextResponse.json({ tenant });
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
  const existing = await scoped.tenant.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const data: Prisma.TenantUpdateInput = {};
  if (typeof body.firstName === "string" && body.firstName.trim() !== "") data.firstName = body.firstName.trim();
  if (typeof body.lastName === "string" && body.lastName.trim() !== "") data.lastName = body.lastName.trim();
  if (typeof body.email === "string") data.email = body.email.trim() === "" ? null : body.email.trim();
  if (typeof body.phone === "string") data.phone = body.phone.trim() === "" ? null : body.phone.trim();
  if (typeof body.emergencyContact === "string") {
    data.emergencyContact = body.emergencyContact.trim() === "" ? null : body.emergencyContact.trim();
  }
  // `status` is intentionally never read from the body — see Global Constraints.

  const tenant = await scoped.tenant.update({ where: { id }, data });
  return NextResponse.json({ tenant });
}
