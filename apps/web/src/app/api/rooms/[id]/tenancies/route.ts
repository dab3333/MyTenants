import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";
import { saveTenantPhoto } from "@/lib/tenantPhoto";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;
  const { id: roomId } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { tenant, startDate, monthlyRate, depositAmount, billingDay } = body as Record<string, unknown>;

  if (!tenant || typeof tenant !== "object") {
    return NextResponse.json({ error: "tenant is required" }, { status: 400 });
  }
  const tenantInput = tenant as Record<string, unknown>;
  const isExisting = typeof tenantInput.id === "string" && tenantInput.id.trim() !== "";
  if (!isExisting) {
    if (typeof tenantInput.firstName !== "string" || tenantInput.firstName.trim() === "") {
      return NextResponse.json({ error: "tenant.firstName is required" }, { status: 400 });
    }
    if (typeof tenantInput.lastName !== "string" || tenantInput.lastName.trim() === "") {
      return NextResponse.json({ error: "tenant.lastName is required" }, { status: 400 });
    }
  }
  if (typeof startDate !== "string" || Number.isNaN(Date.parse(startDate))) {
    return NextResponse.json({ error: "startDate must be a valid date" }, { status: 400 });
  }
  if (typeof monthlyRate !== "number" || !Number.isFinite(monthlyRate) || monthlyRate < 0) {
    return NextResponse.json({ error: "monthlyRate must be a non-negative number" }, { status: 400 });
  }
  if (typeof depositAmount !== "number" || !Number.isFinite(depositAmount) || depositAmount < 0) {
    return NextResponse.json({ error: "depositAmount must be a non-negative number" }, { status: 400 });
  }
  if (
    typeof billingDay !== "number" ||
    !Number.isInteger(billingDay) ||
    billingDay < 1 ||
    billingDay > 31
  ) {
    return NextResponse.json({ error: "billingDay must be an integer between 1 and 31" }, { status: 400 });
  }
  if (
    !isExisting &&
    tenantInput.age !== undefined &&
    tenantInput.age !== null &&
    tenantInput.age !== "" &&
    (typeof tenantInput.age !== "number" || !Number.isInteger(tenantInput.age) || tenantInput.age < 0)
  ) {
    return NextResponse.json({ error: "tenant.age must be a non-negative integer" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);

  const room = await scoped.room.findFirst({ where: { id: roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  try {
    const result = await scoped.$transaction(async (tx) => {
      const activeCount = await tx.tenancy.count({ where: { roomId: room.id, status: "ACTIVE" } });
      if (activeCount >= room.capacity) {
        throw new Error("ROOM_FULL");
      }

      let tenantRecord;
      if (isExisting) {
        const existingTenant = await tx.tenant.findFirst({ where: { id: tenantInput.id as string } });
        if (!existingTenant) throw new Error("TENANT_NOT_FOUND");
        if (existingTenant.status !== "PROSPECT") throw new Error("TENANT_NOT_PROSPECT");
        tenantRecord = await tx.tenant.update({ where: { id: existingTenant.id }, data: { status: "ACTIVE" } });
      } else {
        tenantRecord = await tx.tenant.create({
          data: {
            organizationId: session.organizationId,
            firstName: (tenantInput.firstName as string).trim(),
            lastName: (tenantInput.lastName as string).trim(),
            email:
              typeof tenantInput.email === "string" && tenantInput.email.trim() !== "" ? tenantInput.email.trim() : null,
            phone:
              typeof tenantInput.phone === "string" && tenantInput.phone.trim() !== "" ? tenantInput.phone.trim() : null,
            emergencyContactName:
              typeof tenantInput.emergencyContactName === "string" && tenantInput.emergencyContactName.trim() !== ""
                ? tenantInput.emergencyContactName.trim()
                : null,
            emergencyContactRelationship:
              typeof tenantInput.emergencyContactRelationship === "string" &&
              tenantInput.emergencyContactRelationship.trim() !== ""
                ? tenantInput.emergencyContactRelationship.trim()
                : null,
            emergencyContactPhone:
              typeof tenantInput.emergencyContactPhone === "string" && tenantInput.emergencyContactPhone.trim() !== ""
                ? tenantInput.emergencyContactPhone.trim()
                : null,
            age: typeof tenantInput.age === "number" ? tenantInput.age : null,
            gender:
              typeof tenantInput.gender === "string" && tenantInput.gender.trim() !== ""
                ? tenantInput.gender.trim()
                : null,
            address:
              typeof tenantInput.address === "string" && tenantInput.address.trim() !== ""
                ? tenantInput.address.trim()
                : null,
            occupation:
              typeof tenantInput.occupation === "string" && tenantInput.occupation.trim() !== ""
                ? tenantInput.occupation.trim()
                : null,
            status: "ACTIVE",
          },
        });
      }

      const tenancy = await tx.tenancy.create({
        data: {
          organizationId: session.organizationId,
          tenantId: tenantRecord.id,
          roomId: room.id,
          startDate: new Date(startDate as string),
          monthlyRate: monthlyRate as number,
          depositAmount: depositAmount as number,
          billingDay: billingDay as number,
          status: "ACTIVE",
        },
      });

      return { tenant: tenantRecord, tenancy };
    });

    if (!isExisting && typeof tenantInput.photo === "string") {
      const photoUrl = await saveTenantPhoto(result.tenant.id, tenantInput.photo);
      if (photoUrl) {
        result.tenant = await scoped.tenant.update({ where: { id: result.tenant.id }, data: { photoUrl } });
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ROOM_FULL") {
      return NextResponse.json({ error: "Room has no free capacity" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "TENANT_NOT_PROSPECT") {
      return NextResponse.json({ error: "Tenant is not a prospect" }, { status: 409 });
    }
    throw error;
  }
}
