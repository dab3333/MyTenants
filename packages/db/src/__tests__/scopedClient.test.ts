import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../index";
import { createScopedClient } from "../scopedClient";

describe("createScopedClient", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("only returns rows belonging to the scoped organization on findMany", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B" } });
    await prisma.building.create({ data: { organizationId: orgA.id, name: "A Hall" } });
    await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });

    const scopedA = createScopedClient(orgA.id);
    const buildings = await scopedA.building.findMany();

    expect(buildings).toHaveLength(1);
    expect(buildings[0].name).toBe("A Hall");
  });

  it("stamps organizationId automatically on create, ignoring a mismatched value if passed", async () => {
    const org = await prisma.organization.create({ data: { name: "Org C" } });
    const otherOrg = await prisma.organization.create({ data: { name: "Org D" } });
    const scoped = createScopedClient(org.id);

    const building = await scoped.building.create({
      data: { organizationId: otherOrg.id, name: "Sneaky Hall" },
    });

    expect(building.organizationId).toBe(org.id);
  });

  it("excludes another org's row from findFirst even when queried by id", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org E" } });
    const orgB = await prisma.organization.create({ data: { name: "Org F" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "F Hall" } });

    const scopedA = createScopedClient(orgA.id);
    const result = await scopedA.building.findFirst({ where: { id: buildingB.id } });

    expect(result).toBeNull();
  });

  it("throws a clear error if findUnique is called on a scoped model", async () => {
    const org = await prisma.organization.create({ data: { name: "Org G" } });
    const scoped = createScopedClient(org.id);

    await expect(
      scoped.building.findUnique({ where: { id: "whatever" } })
    ).rejects.toThrow(/findUnique is not allowed on org-scoped models/);
  });

  it("scopes upsert's where so it cannot match another org's row by id, and blocks organizationId forgery on both create and update branches", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org H" } });
    const orgB = await prisma.organization.create({ data: { name: "Org I" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "I Hall" } });

    const scopedA = createScopedClient(orgA.id);

    // Attempting to upsert by orgB's row id, scoped as orgA: the merged where
    // (id + organizationId: orgA.id) cannot match orgB's row, so Prisma takes
    // the create branch instead of updating orgB's row.
    const result = await scopedA.building.upsert({
      where: { id: buildingB.id },
      create: { organizationId: orgB.id, name: "Sneaky Create Hall" },
      update: { organizationId: orgB.id, name: "Sneaky Update Hall" },
    });

    // A new row was created, scoped to orgA, not an update of orgB's row.
    expect(result.id).not.toBe(buildingB.id);
    expect(result.organizationId).toBe(orgA.id);
    expect(result.name).toBe("Sneaky Create Hall");

    // orgB's original row is untouched.
    const untouched = await prisma.building.findUnique({ where: { id: buildingB.id } });
    expect(untouched?.organizationId).toBe(orgB.id);
    expect(untouched?.name).toBe("I Hall");

    // Now prove the update branch also stamps organizationId: upsert again by
    // the row we just created, which does exist in orgA's scope this time.
    const updated = await scopedA.building.upsert({
      where: { id: result.id },
      create: { organizationId: orgB.id, name: "Should Not Create" },
      update: { organizationId: orgB.id, name: "Updated Hall" },
    });

    expect(updated.id).toBe(result.id);
    expect(updated.organizationId).toBe(orgA.id);
    expect(updated.name).toBe("Updated Hall");
  });

  it("stamps organizationId on every row created via createManyAndReturn, ignoring mismatched values", async () => {
    const org = await prisma.organization.create({ data: { name: "Org J" } });
    const otherOrg = await prisma.organization.create({ data: { name: "Org K" } });
    const scoped = createScopedClient(org.id);

    const rows = await scoped.building.createManyAndReturn({
      data: [
        { organizationId: otherOrg.id, name: "Row 1" },
        { organizationId: otherOrg.id, name: "Row 2" },
      ],
    });

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.organizationId).toBe(org.id);
    }
  });
});
