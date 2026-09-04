import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma, createScopedClient } from "@mytenants/db";
import { POST } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

async function makeRoom(organizationId: string, capacity = 1) {
  const building = await prisma.building.create({ data: { organizationId, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId, buildingId: building.id, label: "1F" } });
  return prisma.room.create({
    data: { organizationId, floorId: floor.id, name: "101", capacity, monthlyRate: "3000.00" },
  });
}

describe("scoped.$transaction composability (foundational check)", () => {
  it("stamps organizationId on writes made inside the transaction, and rejects cross-org reads inside it", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Tx Check" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Tx Check" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });

    const scopedA = createScopedClient(orgA.id);

    const created = await scopedA.$transaction(async (tx) => {
      return tx.tenant.create({
        data: { organizationId: orgB.id, firstName: "Forged", lastName: "Org", status: "PROSPECT" },
      });
    });
    expect(created.organizationId).toBe(orgA.id);

    const foundInTx = await scopedA.$transaction(async (tx) => {
      return tx.building.findFirst({ where: { id: buildingB.id } });
    });
    expect(foundInTx).toBeNull();
  });

  it("rolls back a write made earlier in the transaction when a later step throws", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Tx Rollback Check" } });
    const scoped = createScopedClient(org.id);

    await expect(
      scoped.$transaction(async (tx) => {
        await tx.tenant.create({
          data: { organizationId: org.id, firstName: "RollbackProbe", lastName: "ShouldNotPersist", status: "PROSPECT" },
        });
        throw new Error("FORCE_ROLLBACK");
      })
    ).rejects.toThrow("FORCE_ROLLBACK");

    const survived = await prisma.tenant.findFirst({ where: { organizationId: org.id, firstName: "RollbackProbe" } });
    expect(survived).toBeNull();
  });
});

describe("POST /api/rooms/[id]/tenancies", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("admits a new tenant into a room, creating both Tenant and Tenancy", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Admit New" } });
    const room = await makeRoom(org.id, 2);

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          tenant: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
          startDate: "2026-01-01",
          monthlyRate: 3000,
          depositAmount: 3000,
        }),
      }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.tenant.status).toBe("ACTIVE");
    expect(data.tenancy.roomId).toBe(room.id);
    expect(data.tenancy.status).toBe("ACTIVE");

    const activeCount = await prisma.tenancy.count({ where: { roomId: room.id, status: "ACTIVE" } });
    expect(activeCount).toBe(1);
  });

  it("admits an existing PROSPECT tenant, transitioning their status to ACTIVE", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Admit Prospect" } });
    const room = await makeRoom(org.id, 1);
    const prospect = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "P", lastName: "Rospect", status: "PROSPECT" } });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ tenant: { id: prospect.id }, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }),
      }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.tenant.id).toBe(prospect.id);
    expect(data.tenant.status).toBe("ACTIVE");
  });

  it("returns 409 and creates nothing when the room has no free capacity", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Admit Full" } });
    const room = await makeRoom(org.id, 1);
    const existingTenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "X", lastName: "Y", status: "ACTIVE" } });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: existingTenant.id, roomId: room.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ tenant: { firstName: "New", lastName: "Comer" }, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }),
      }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(409);
    const tenantCount = await prisma.tenant.count({ where: { organizationId: org.id, firstName: "New" } });
    expect(tenantCount).toBe(0);
  });

  it("returns 404 when the room belongs to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Admit Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Admit Guard" } });
    const roomB = await makeRoom(orgB.id, 5);

    sessionFor(orgA.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ tenant: { firstName: "A", lastName: "B" }, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }),
      }),
      { params: Promise.resolve({ id: roomB.id }) }
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 when the existing tenant id belongs to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Tenant Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Tenant Guard" } });
    const room = await makeRoom(orgA.id, 1);
    const tenantB = await prisma.tenant.create({ data: { organizationId: orgB.id, firstName: "B", lastName: "Tenant", status: "PROSPECT" } });

    sessionFor(orgA.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ tenant: { id: tenantB.id }, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }),
      }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(404);
  });

  it("returns 409 when the existing tenant is not a PROSPECT", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Not Prospect" } });
    const room = await makeRoom(org.id, 1);
    const activeTenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "Already", lastName: "Active", status: "ACTIVE" } });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ tenant: { id: activeTenant.id }, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }),
      }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(409);
  });

  it.each([
    [{ tenant: {}, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }, "tenant.firstName is required"],
    [{ tenant: { firstName: "A" }, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }, "tenant.lastName is required"],
    [{ tenant: { firstName: "A", lastName: "B" }, startDate: "not-a-date", monthlyRate: 3000, depositAmount: 3000 }, "startDate must be a valid date"],
    [{ tenant: { firstName: "A", lastName: "B" }, startDate: "2026-01-01", depositAmount: 3000 }, "monthlyRate must be a non-negative number"],
    [{ tenant: { firstName: "A", lastName: "B" }, startDate: "2026-01-01", monthlyRate: 3000 }, "depositAmount must be a non-negative number"],
  ])("returns 400 for invalid body %j", async (body, expectedError) => {
    const org = await prisma.organization.create({ data: { name: `Org Admit Invalid ${JSON.stringify(body)}` } });
    const room = await makeRoom(org.id, 5);

    sessionFor(org.id);
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }), {
      params: Promise.resolve({ id: room.id }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe(expectedError);
  });
});
