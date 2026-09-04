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

describe("GET/PATCH /api/buildings/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 404 for a building belonging to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Detail" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Detail" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });

    sessionFor(orgA.id);
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: buildingB.id }) });

    expect(res.status).toBe(404);
  });

  it("updates a building's name for its own organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Update" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Old Name" } });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ name: "New Name" }) }),
      { params: Promise.resolve({ id: building.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.building.name).toBe("New Name");
  });

  it("returns 404 when trying to update another organization's building", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Update Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Update Guard" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall Guard" } });

    sessionFor(orgA.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ name: "Hijacked" }) }),
      { params: Promise.resolve({ id: buildingB.id }) }
    );

    expect(res.status).toBe(404);
  });
});
