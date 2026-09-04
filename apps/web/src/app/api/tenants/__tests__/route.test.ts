import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { GET, POST } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

describe("GET/POST /api/tenants", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/tenants"));
    expect(res.status).toBe(401);
  });

  it("creates a prospect tenant and only lists it for the same organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Tenants" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Tenants" } });

    sessionFor(orgA.id);
    const createRes = await POST(
      new Request("http://localhost/api/tenants", {
        method: "POST",
        body: JSON.stringify({ firstName: "Jane", lastName: "Doe", email: "jane@example.com" }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.tenant.status).toBe("PROSPECT");
    expect(created.tenant.organizationId).toBe(orgA.id);

    const listResA = await GET(new Request("http://localhost/api/tenants"));
    const listedA = await listResA.json();
    expect(listedA.tenants).toHaveLength(1);
    expect(listedA.tenants[0].firstName).toBe("Jane");

    sessionFor(orgB.id);
    const listResB = await GET(new Request("http://localhost/api/tenants"));
    const listedB = await listResB.json();
    expect(listedB.tenants).toHaveLength(0);
  });

  it("returns 400 when firstName or lastName is missing", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Missing Name" } });
    sessionFor(org.id);

    const res = await POST(
      new Request("http://localhost/api/tenants", { method: "POST", body: JSON.stringify({ lastName: "Doe" }) })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("firstName is required");
  });

  it("filters by status", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Status Filter" } });
    await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "One", status: "PROSPECT" } });
    await prisma.tenant.create({ data: { organizationId: org.id, firstName: "B", lastName: "Two", status: "ACTIVE" } });

    sessionFor(org.id);
    const res = await GET(new Request("http://localhost/api/tenants?status=ACTIVE"));
    const data = await res.json();
    expect(data.tenants).toHaveLength(1);
    expect(data.tenants[0].firstName).toBe("B");
  });

  it("rejects an invalid status filter with 400", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Invalid Status" } });
    sessionFor(org.id);

    const res = await GET(new Request("http://localhost/api/tenants?status=NOT_A_STATUS"));
    expect(res.status).toBe(400);
  });

  it("filters by search term matching first or last name (case-insensitive)", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Search Filter" } });
    await prisma.tenant.create({ data: { organizationId: org.id, firstName: "Alice", lastName: "Smith", status: "PROSPECT" } });
    await prisma.tenant.create({ data: { organizationId: org.id, firstName: "Bob", lastName: "Jones", status: "PROSPECT" } });

    sessionFor(org.id);
    const res = await GET(new Request("http://localhost/api/tenants?search=ali"));
    const data = await res.json();
    expect(data.tenants).toHaveLength(1);
    expect(data.tenants[0].firstName).toBe("Alice");
  });

  it("filters by buildingId, matching only tenants with an active tenancy in that building", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Building Filter" } });
    const buildingA = await prisma.building.create({ data: { organizationId: org.id, name: "A Hall" } });
    const buildingB = await prisma.building.create({ data: { organizationId: org.id, name: "B Hall" } });
    const floorA = await prisma.floor.create({ data: { organizationId: org.id, buildingId: buildingA.id, label: "1F" } });
    const floorB = await prisma.floor.create({ data: { organizationId: org.id, buildingId: buildingB.id, label: "1F" } });
    const roomA = await prisma.room.create({ data: { organizationId: org.id, floorId: floorA.id, name: "101", capacity: 2, monthlyRate: "3000.00" } });
    const roomB = await prisma.room.create({ data: { organizationId: org.id, floorId: floorB.id, name: "101", capacity: 2, monthlyRate: "3000.00" } });
    const tenantA = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "In", lastName: "BuildingA", status: "ACTIVE" } });
    const tenantB = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "In", lastName: "BuildingB", status: "ACTIVE" } });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenantA.id, roomId: roomA.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenantB.id, roomId: roomB.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });

    sessionFor(org.id);
    const res = await GET(new Request(`http://localhost/api/tenants?buildingId=${buildingA.id}`));
    const data = await res.json();
    expect(data.tenants).toHaveLength(1);
    expect(data.tenants[0].lastName).toBe("BuildingA");
  });
});
