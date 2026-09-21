import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { DELETE, PATCH } from "../route";

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

describe("DELETE /api/floors/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("deletes an empty floor belonging to the caller's organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Floor Delete" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });

    sessionFor(org.id);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: floor.id }),
    });

    expect(res.status).toBe(200);
    const found = await prisma.floor.findFirst({ where: { id: floor.id } });
    expect(found).toBeNull();
  });

  it("refuses to delete a floor that still has rooms", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Floor Delete Guard" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 1, monthlyRate: 3000 },
    });

    sessionFor(org.id);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: floor.id }),
    });

    expect(res.status).toBe(409);
    const found = await prisma.floor.findFirst({ where: { id: floor.id } });
    expect(found).not.toBeNull();
  });

  it("returns 404 when deleting another organization's floor", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Floor Delete Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Floor Delete Guard" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });
    const floorB = await prisma.floor.create({ data: { organizationId: orgB.id, buildingId: buildingB.id, label: "B1F" } });

    sessionFor(orgA.id);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: floorB.id }),
    });

    expect(res.status).toBe(404);
  });
});
