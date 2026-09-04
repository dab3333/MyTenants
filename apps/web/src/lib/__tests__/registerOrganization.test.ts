import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@mytenants/db";
import { registerOrganization } from "../registerOrganization";
import bcrypt from "bcryptjs";

describe("registerOrganization", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates an Organization and an OWNER User with a hashed password", async () => {
    const result = await registerOrganization({
      organizationName: "Sunrise Dorms",
      ownerName: "Alex Cruz",
      email: `alex-${Date.now()}@example.com`,
      password: "correct horse battery staple",
    });

    expect(result.organizationId).toBeTruthy();
    expect(result.userId).toBeTruthy();

    const user = await prisma.user.findFirst({ where: { id: result.userId } });
    expect(user?.role).toBe("OWNER");
    expect(user?.passwordHash).not.toBe("correct horse battery staple");
    expect(await bcrypt.compare("correct horse battery staple", user!.passwordHash)).toBe(true);
  });

  it("rejects a duplicate email", async () => {
    const email = `dup-${Date.now()}@example.com`;
    await registerOrganization({
      organizationName: "Org One",
      ownerName: "Owner One",
      email,
      password: "password12345",
    });

    await expect(
      registerOrganization({
        organizationName: "Org Two",
        ownerName: "Owner Two",
        email,
        password: "password12345",
      })
    ).rejects.toThrow(/already/i);
  });
});
