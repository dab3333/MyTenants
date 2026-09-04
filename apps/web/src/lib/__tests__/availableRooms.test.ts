import { describe, it, expect } from "vitest";
import { prisma, createScopedClient } from "@mytenants/db";
import { getAvailableRooms } from "../availableRooms";

describe("getAvailableRooms", () => {
  it("returns only rooms with free capacity, across multiple buildings, org-scoped", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Available Rooms" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Available Rooms" } });

    const buildingA1 = await prisma.building.create({ data: { organizationId: orgA.id, name: "A Hall" } });
    const buildingA2 = await prisma.building.create({ data: { organizationId: orgA.id, name: "A Annex" } });
    const floorA1 = await prisma.floor.create({ data: { organizationId: orgA.id, buildingId: buildingA1.id, label: "1F" } });
    const floorA2 = await prisma.floor.create({ data: { organizationId: orgA.id, buildingId: buildingA2.id, label: "1F" } });

    const fullRoom = await prisma.room.create({
      data: { organizationId: orgA.id, floorId: floorA1.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
    });
    const vacantRoom = await prisma.room.create({
      data: { organizationId: orgA.id, floorId: floorA2.id, name: "201", capacity: 2, monthlyRate: "3500.00" },
    });
    const tenant = await prisma.tenant.create({ data: { organizationId: orgA.id, firstName: "A", lastName: "One", status: "ACTIVE" } });
    await prisma.tenancy.create({
      data: { organizationId: orgA.id, tenantId: tenant.id, roomId: fullRoom.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });

    // Another org's rooms must never appear.
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });
    const floorB = await prisma.floor.create({ data: { organizationId: orgB.id, buildingId: buildingB.id, label: "1F" } });
    await prisma.room.create({ data: { organizationId: orgB.id, floorId: floorB.id, name: "999", capacity: 5, monthlyRate: "1.00" } });

    const scoped = createScopedClient(orgA.id);
    const available = await getAvailableRooms(scoped);

    expect(available).toHaveLength(1);
    expect(available[0].roomId).toBe(vacantRoom.id);
    expect(available[0].buildingName).toBe("A Annex");
    expect(available[0].floorLabel).toBe("1F");
    expect(available[0].capacity).toBe(2);
    expect(available[0].occupied).toBe(0);
  });

  it("excludes a room whose capacity was reduced below its current occupancy (free = max(0, capacity - occupied))", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Reduced Capacity" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
    });
    const tenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "One", status: "ACTIVE" } });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant.id, roomId: room.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });
    // Reduce capacity below the current 1 active tenancy.
    await prisma.room.update({ where: { id: room.id }, data: { capacity: 0 } });

    const scoped = createScopedClient(org.id);
    const available = await getAvailableRooms(scoped);

    expect(available).toHaveLength(0);
  });
});
