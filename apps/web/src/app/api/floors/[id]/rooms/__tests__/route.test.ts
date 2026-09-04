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

describe("POST /api/floors/[id]/rooms", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("creates a room under a floor belonging to the caller's organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Room Create" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "101", capacity: 2, monthlyRate: 3000 }),
      }),
      { params: Promise.resolve({ id: floor.id }) }
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.room.name).toBe("101");
    expect(data.room.capacity).toBe(2);
    expect(data.room.floorId).toBe(floor.id);
    expect(data.room.organizationId).toBe(org.id);
  });

  it("returns 404 when the floor belongs to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Room Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Room Guard" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });
    const floorB = await prisma.floor.create({ data: { organizationId: orgB.id, buildingId: buildingB.id, label: "B1F" } });

    sessionFor(orgA.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "101", capacity: 2, monthlyRate: 3000 }),
      }),
      { params: Promise.resolve({ id: floorB.id }) }
    );

    expect(res.status).toBe(404);
    const created = await prisma.room.findFirst({ where: { floorId: floorB.id } });
    expect(created).toBeNull();
  });

  it.each([
    [{ capacity: 2, monthlyRate: 3000 }, "name is required"],
    [{ name: "101", monthlyRate: 3000 }, "capacity must be a positive integer"],
    [{ name: "101", capacity: 0, monthlyRate: 3000 }, "capacity must be a positive integer"],
    [{ name: "101", capacity: 2 }, "monthlyRate must be a non-negative number"],
    [{ name: "101", capacity: 2, monthlyRate: -5 }, "monthlyRate must be a non-negative number"],
  ])("returns 400 for invalid body %j", async (body, expectedError) => {
    const org = await prisma.organization.create({ data: { name: `Org Room Invalid ${JSON.stringify(body)}` } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: floor.id }) }
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe(expectedError);
  });
});
