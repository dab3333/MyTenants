import { describe, it, expect } from "vitest";
import { prisma, createScopedClient } from "@mytenants/db";
import { getBuildingOverview } from "../buildingOverview";

describe("getBuildingOverview", () => {
  it("returns null for a building in another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Overview Null" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Overview Null" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });

    const scopedA = createScopedClient(orgA.id);
    const result = await getBuildingOverview(scopedA, buildingB.id);

    expect(result).toBeNull();
  });

  it("computes occupancy from ACTIVE tenancies only, ignoring ENDED ones and other rooms", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Overview Full" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Main Hall" } });
    const floor1 = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const floor2 = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "2F" } });

    const fullRoom = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor1.id, name: "101", capacity: 2, monthlyRate: "3000.00" },
    });
    const partialRoom = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor1.id, name: "102", capacity: 2, monthlyRate: "3000.00" },
    });
    const vacantRoom = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor2.id, name: "201", capacity: 1, monthlyRate: "3500.00" },
    });

    const tenant1 = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "One", status: "ACTIVE" } });
    const tenant2 = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "B", lastName: "Two", status: "ACTIVE" } });
    const tenant3 = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "C", lastName: "Three", status: "MOVED_OUT" } });

    // fullRoom: 2 ACTIVE tenancies against capacity 2 -> full
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant1.id, roomId: fullRoom.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant2.id, roomId: fullRoom.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });

    // partialRoom: 1 ACTIVE + 1 ENDED (should not count) against capacity 2 -> partial
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant3.id, roomId: partialRoom.id, startDate: new Date(), endDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ENDED" },
    });
    const activeTenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "D", lastName: "Four", status: "ACTIVE" } });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: activeTenant.id, roomId: partialRoom.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });

    // vacantRoom: no tenancies at all

    const scoped = createScopedClient(org.id);
    const overview = await getBuildingOverview(scoped, building.id);

    expect(overview).not.toBeNull();
    expect(overview!.floors).toHaveLength(2);

    const floor1Result = overview!.floors.find((f) => f.label === "1F")!;
    const fullRoomResult = floor1Result.rooms.find((r) => r.name === "101")!;
    const partialRoomResult = floor1Result.rooms.find((r) => r.name === "102")!;
    expect(fullRoomResult.occupied).toBe(2);
    expect(fullRoomResult.capacity).toBe(2);
    expect(partialRoomResult.occupied).toBe(1);

    const floor2Result = overview!.floors.find((f) => f.label === "2F")!;
    const vacantRoomResult = floor2Result.rooms.find((r) => r.name === "201")!;
    expect(vacantRoomResult.occupied).toBe(0);
  });
});
