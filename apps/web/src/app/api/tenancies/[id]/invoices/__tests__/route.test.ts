import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { POST } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

async function makeTenancy(organizationId: string) {
  const building = await prisma.building.create({ data: { organizationId, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId, buildingId: building.id, label: "1F" } });
  const room = await prisma.room.create({ data: { organizationId, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" } });
  const tenant = await prisma.tenant.create({ data: { organizationId, firstName: "A", lastName: "Tenant", status: "ACTIVE" } });
  return prisma.tenancy.create({
    data: { organizationId, tenantId: tenant.id, roomId: room.id, startDate: new Date("2026-01-01"), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
  });
}

describe("POST /api/tenancies/[id]/invoices", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("creates a manual invoice against a tenancy", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Manual Invoice" } });
    const tenancy = await makeTenancy(org.id);

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ periodStart: "2026-01-01", periodEnd: "2026-01-31", amountDue: 3000, dueDate: "2026-01-05" }),
      }),
      { params: Promise.resolve({ id: tenancy.id }) }
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.invoice.status).toBe("PENDING");
    expect(data.invoice.organizationId).toBe(org.id);
    expect(data.invoice.tenancyId).toBe(tenancy.id);
  });

  it("returns 404 when the tenancy belongs to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Manual Invoice" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Manual Invoice" } });
    const tenancyB = await makeTenancy(orgB.id);

    sessionFor(orgA.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ periodStart: "2026-01-01", periodEnd: "2026-01-31", amountDue: 3000, dueDate: "2026-01-05" }),
      }),
      { params: Promise.resolve({ id: tenancyB.id }) }
    );

    expect(res.status).toBe(404);
  });

  it("returns 409 when an invoice already exists for this tenancy and periodStart", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Duplicate Invoice" } });
    const tenancy = await makeTenancy(org.id);
    await prisma.invoice.create({
      data: { organizationId: org.id, tenancyId: tenancy.id, periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), amountDue: "3000.00", dueDate: new Date("2026-01-05") },
    });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ periodStart: "2026-01-01", periodEnd: "2026-01-31", amountDue: 3000, dueDate: "2026-01-05" }),
      }),
      { params: Promise.resolve({ id: tenancy.id }) }
    );

    expect(res.status).toBe(409);
  });

  it.each([
    [{ periodEnd: "2026-01-31", amountDue: 3000, dueDate: "2026-01-05" }, "periodStart must be a valid date"],
    [{ periodStart: "2026-01-01", amountDue: 3000, dueDate: "2026-01-05" }, "periodEnd must be a valid date"],
    [{ periodStart: "2026-01-01", periodEnd: "2026-01-31", dueDate: "2026-01-05" }, "amountDue must be a non-negative number"],
    [{ periodStart: "2026-01-01", periodEnd: "2026-01-31", amountDue: 3000 }, "dueDate must be a valid date"],
  ])("returns 400 for invalid body %j", async (body, expectedError) => {
    const org = await prisma.organization.create({ data: { name: `Org Manual Invoice Invalid ${JSON.stringify(body)}` } });
    const tenancy = await makeTenancy(org.id);

    sessionFor(org.id);
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }), {
      params: Promise.resolve({ id: tenancy.id }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe(expectedError);
  });
});
