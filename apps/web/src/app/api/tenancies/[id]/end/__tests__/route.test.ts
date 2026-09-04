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

async function makeActiveTenancy(organizationId: string) {
  const building = await prisma.building.create({ data: { organizationId, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId, buildingId: building.id, label: "1F" } });
  const room = await prisma.room.create({ data: { organizationId, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" } });
  const tenant = await prisma.tenant.create({ data: { organizationId, firstName: "A", lastName: "Tenant", status: "ACTIVE" } });
  const tenancy = await prisma.tenancy.create({
    data: { organizationId, tenantId: tenant.id, roomId: room.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
  });
  return { room, tenant, tenancy };
}

describe("POST /api/tenancies/[id]/end", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("ends a tenancy, sets endDate, and moves the tenant to MOVED_OUT, freeing the room", async () => {
    const org = await prisma.organization.create({ data: { name: "Org End Tenancy" } });
    const { room, tenant, tenancy } = await makeActiveTenancy(org.id);

    sessionFor(org.id);
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: tenancy.id }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tenancy.status).toBe("ENDED");
    expect(data.tenancy.endDate).not.toBeNull();
    expect(data.tenant.status).toBe("MOVED_OUT");

    const activeCount = await prisma.tenancy.count({ where: { roomId: room.id, status: "ACTIVE" } });
    expect(activeCount).toBe(0);
    const refetchedTenant = await prisma.tenant.findFirst({ where: { id: tenant.id } });
    expect(refetchedTenant?.status).toBe("MOVED_OUT");
  });

  it("returns 404 when the tenancy belongs to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A End Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B End Guard" } });
    const { tenancy: tenancyB } = await makeActiveTenancy(orgB.id);

    sessionFor(orgA.id);
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: tenancyB.id }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 409 when the tenancy is already ended", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Already Ended" } });
    const { tenant, tenancy } = await makeActiveTenancy(org.id);
    await prisma.tenancy.update({ where: { id: tenancy.id }, data: { status: "ENDED", endDate: new Date() } });

    sessionFor(org.id);
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: tenancy.id }),
    });

    expect(res.status).toBe(409);
    const refetchedTenant = await prisma.tenant.findFirst({ where: { id: tenant.id } });
    expect(refetchedTenant?.status).toBe("ACTIVE");
  });
});
