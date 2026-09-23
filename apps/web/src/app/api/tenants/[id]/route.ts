import { NextResponse } from "next/server";
import { createScopedClient, type Prisma } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";
import { deleteTenantPhoto, saveTenantPhoto } from "@/lib/tenantPhoto";

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
  if (typeof body.emergencyContactName === "string") {
    data.emergencyContactName = body.emergencyContactName.trim() === "" ? null : body.emergencyContactName.trim();
  }
  if (typeof body.emergencyContactRelationship === "string") {
    data.emergencyContactRelationship =
      body.emergencyContactRelationship.trim() === "" ? null : body.emergencyContactRelationship.trim();
  }
  if (typeof body.emergencyContactPhone === "string") {
    data.emergencyContactPhone = body.emergencyContactPhone.trim() === "" ? null : body.emergencyContactPhone.trim();
  }
  if (body.age === null || body.age === "") {
    data.age = null;
  } else if (typeof body.age === "number") {
    if (!Number.isInteger(body.age) || body.age < 0) {
      return NextResponse.json({ error: "age must be a non-negative integer" }, { status: 400 });
    }
    data.age = body.age;
  }
  if (typeof body.gender === "string") data.gender = body.gender.trim() === "" ? null : body.gender.trim();
  if (typeof body.address === "string") data.address = body.address.trim() === "" ? null : body.address.trim();
  if (typeof body.occupation === "string") {
    data.occupation = body.occupation.trim() === "" ? null : body.occupation.trim();
  }
  // `status` is intentionally never read from the body — see Global Constraints.

  if (body.photo === null) {
    await deleteTenantPhoto(existing.photoUrl);
    data.photoUrl = null;
  } else if (typeof body.photo === "string") {
    const photoUrl = await saveTenantPhoto(id, body.photo);
    if (!photoUrl) {
      return NextResponse.json({ error: "photo must be a JPEG, PNG, or WebP image under 4MB" }, { status: 400 });
    }
    await deleteTenantPhoto(existing.photoUrl);
    data.photoUrl = photoUrl;
  }

  const tenant = await scoped.tenant.update({ where: { id }, data });
  return NextResponse.json({ tenant });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;
  const { id } = await params;

  const scoped = createScopedClient(session.organizationId);
  const existing = await scoped.tenant.findFirst({
    where: { id },
    include: { tenancies: { select: { id: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (existing.status !== "PROSPECT") {
    return NextResponse.json({ error: "Only prospects can be removed this way" }, { status: 409 });
  }
  if (existing.tenancies.length > 0) {
    return NextResponse.json({ error: "This tenant already has tenancy history" }, { status: 409 });
  }

  await deleteTenantPhoto(existing.photoUrl);
  await scoped.tenant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
