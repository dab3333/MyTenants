import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { GET, PATCH, DELETE } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

describe("GET/PATCH /api/tenants/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 404 for a tenant belonging to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Tenant Detail" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Tenant Detail" } });
    const tenantB = await prisma.tenant.create({ data: { organizationId: orgB.id, firstName: "B", lastName: "Tenant", status: "PROSPECT" } });

    sessionFor(orgA.id);
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: tenantB.id }) });
    expect(res.status).toBe(404);
  });

  it("updates a tenant's profile fields for its own organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Tenant Update" } });
    const tenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "Old", lastName: "Name", status: "PROSPECT" } });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ firstName: "New", phone: "555-1234" }) }),
      { params: Promise.resolve({ id: tenant.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tenant.firstName).toBe("New");
    expect(data.tenant.phone).toBe("555-1234");
  });

  it("ignores an attempt to change status via PATCH", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Tenant Status Guard" } });
    const tenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "B", status: "PROSPECT" } });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "ACTIVE" }) }),
      { params: Promise.resolve({ id: tenant.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tenant.status).toBe("PROSPECT");
  });

  it("returns 404 when updating another organization's tenant", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Tenant Update Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Tenant Update Guard" } });
    const tenantB = await prisma.tenant.create({ data: { organizationId: orgB.id, firstName: "B", lastName: "Tenant", status: "PROSPECT" } });

    sessionFor(orgA.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ firstName: "Hijacked" }) }),
      { params: Promise.resolve({ id: tenantB.id }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/tenants/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("removes a prospect with no tenancy history", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Prospect Delete" } });
    const tenant = await prisma.tenant.create({
      data: { organizationId: org.id, firstName: "Diego", lastName: "Aquino", status: "PROSPECT" },
    });

    sessionFor(org.id);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: tenant.id }),
    });

    expect(res.status).toBe(200);
    const found = await prisma.tenant.findFirst({ where: { id: tenant.id } });
    expect(found).toBeNull();
  });

  it("refuses to remove a tenant that is not a prospect", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Prospect Delete Status Guard" } });
    const tenant = await prisma.tenant.create({
      data: { organizationId: org.id, firstName: "Active", lastName: "Tenant", status: "ACTIVE" },
    });

    sessionFor(org.id);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: tenant.id }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("Only prospects can be removed this way");
  });

  it("refuses to remove a prospect that already has tenancy history", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Prospect Delete Tenancy Guard" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 2, monthlyRate: "3000.00" },
    });
    const tenant = await prisma.tenant.create({
      data: { organizationId: org.id, firstName: "Was", lastName: "Prospect", status: "PROSPECT" },
    });
    await prisma.tenancy.create({
      data: {
        organizationId: org.id,
        tenantId: tenant.id,
        roomId: room.id,
        startDate: new Date(),
        monthlyRate: "3000.00",
        depositAmount: "3000.00",
        status: "ENDED",
      },
    });

    sessionFor(org.id);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: tenant.id }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("This tenant already has tenancy history");
  });

  it("returns 404 when removing another organization's tenant", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Prospect Delete Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Prospect Delete Guard" } });
    const tenantB = await prisma.tenant.create({
      data: { organizationId: orgB.id, firstName: "B", lastName: "Prospect", status: "PROSPECT" },
    });

    sessionFor(orgA.id);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: tenantB.id }),
    });
    expect(res.status).toBe(404);
  });
});
