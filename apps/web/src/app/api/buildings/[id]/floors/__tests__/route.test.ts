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

describe("POST /api/buildings/[id]/floors", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("creates a floor under a building belonging to the caller's organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Floor Create" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ label: "1F" }) }),
      { params: Promise.resolve({ id: building.id }) }
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.floor.label).toBe("1F");
    expect(data.floor.buildingId).toBe(building.id);
    expect(data.floor.organizationId).toBe(org.id);
  });

  it("returns 404 (not 403) when the building belongs to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Floor Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Floor Guard" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });

    sessionFor(orgA.id);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ label: "1F" }) }),
      { params: Promise.resolve({ id: buildingB.id }) }
    );

    expect(res.status).toBe(404);
    const created = await prisma.floor.findFirst({ where: { buildingId: buildingB.id } });
    expect(created).toBeNull();
  });

  it("returns 400 when label is missing", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Floor Missing Label" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: building.id }) }
    );

    expect(res.status).toBe(400);
  });
});
