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
});
