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

describe("PATCH /api/rooms/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("updates a room's capacity and rate for its own organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Room Update" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 2, monthlyRate: "3000.00" },
    });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ capacity: 3, monthlyRate: 3500 }) }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.room.capacity).toBe(3);
    expect(Number(data.room.monthlyRate)).toBe(3500);
  });

  it("returns 400 when capacity is present but not a positive integer", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Room Update Invalid Capacity" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 2, monthlyRate: "3000.00" },
    });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ capacity: 0 }) }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("capacity must be a positive integer");
  });

  it("returns 400 when monthlyRate is present but negative", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Room Update Invalid Rate" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 2, monthlyRate: "3000.00" },
    });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ monthlyRate: -5 }) }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("monthlyRate must be a non-negative number");
  });

  it("returns 404 when updating another organization's room", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Room Update Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Room Update Guard" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });
    const floorB = await prisma.floor.create({ data: { organizationId: orgB.id, buildingId: buildingB.id, label: "B1F" } });
    const roomB = await prisma.room.create({
      data: { organizationId: orgB.id, floorId: floorB.id, name: "B101", capacity: 2, monthlyRate: "3000.00" },
    });

    sessionFor(orgA.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ capacity: 99 }) }),
      { params: Promise.resolve({ id: roomB.id }) }
    );

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/rooms/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("deletes a room with no active tenancy", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Room Delete" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 2, monthlyRate: "3000.00" },
    });

    sessionFor(org.id);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: room.id }),
    });

    expect(res.status).toBe(200);
    const found = await prisma.room.findFirst({ where: { id: room.id } });
    expect(found).toBeNull();
  });

  it("refuses to delete a room with an active tenant", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Room Delete Guard" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 2, monthlyRate: "3000.00" },
    });
    const tenant = await prisma.tenant.create({
      data: { organizationId: org.id, firstName: "Pat", lastName: "Tenant", status: "ACTIVE" },
    });
    await prisma.tenancy.create({
      data: {
        organizationId: org.id,
        tenantId: tenant.id,
        roomId: room.id,
        startDate: new Date(),
        monthlyRate: "3000.00",
        depositAmount: "3000.00",
        status: "ACTIVE",
      },
    });

    sessionFor(org.id);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: room.id }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("This room has an active tenant. End their tenancy before deleting it.");
    const found = await prisma.room.findFirst({ where: { id: room.id } });
    expect(found).not.toBeNull();
  });

  it("returns 404 when deleting another organization's room", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Room Delete Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Room Delete Guard" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });
    const floorB = await prisma.floor.create({ data: { organizationId: orgB.id, buildingId: buildingB.id, label: "B1F" } });
    const roomB = await prisma.room.create({
      data: { organizationId: orgB.id, floorId: floorB.id, name: "B101", capacity: 2, monthlyRate: "3000.00" },
    });

    sessionFor(orgA.id);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params: Promise.resolve({ id: roomB.id }),
    });

    expect(res.status).toBe(404);
  });
});
