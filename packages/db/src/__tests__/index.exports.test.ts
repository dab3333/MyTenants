import { describe, it, expect, afterAll } from "vitest";
import { prisma, createScopedClient } from "../index";

describe("@mytenants/db package entry point", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("re-exports createScopedClient from the package's own entry point, not just the relative scopedClient module", async () => {
    expect(typeof createScopedClient).toBe("function");

    // Prove it's the real, working implementation (not a stub) by exercising
    // it end-to-end through the entry-point import alone.
    const org = await prisma.organization.create({ data: { name: "Org Entry Point" } });
    const otherOrg = await prisma.organization.create({ data: { name: "Org Entry Point Other" } });

    const scoped = createScopedClient(org.id);
    const building = await scoped.building.create({
      data: { organizationId: otherOrg.id, name: "Entry Point Hall" },
    });

    expect(building.organizationId).toBe(org.id);
  });
});
