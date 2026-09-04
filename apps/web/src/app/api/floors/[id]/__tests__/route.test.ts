import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { PATCH } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

describe("PATCH /api/floors/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("renames a floor belonging to the caller's organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Floor Rename" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "Old" } });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ label: "New" }) }),
      { params: Promise.resolve({ id: floor.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.floor.label).toBe("New");
  });

  it("returns 404 when renaming another organization's floor", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Floor Rename Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Floor Rename Guard" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });
    const floorB = await prisma.floor.create({ data: { organizationId: orgB.id, buildingId: buildingB.id, label: "B1F" } });

    sessionFor(orgA.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ label: "Hijacked" }) }),
      { params: Promise.resolve({ id: floorB.id }) }
    );

    expect(res.status).toBe(404);
  });
});
