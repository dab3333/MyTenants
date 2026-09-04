import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { GET, PATCH } from "../route";

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
