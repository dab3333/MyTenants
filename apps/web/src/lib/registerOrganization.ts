import { prisma } from "@mytenants/db";
import bcrypt from "bcryptjs";

export async function registerOrganization({
  organizationName,
  ownerName,
  email,
  password,
}: {
  organizationName: string;
  ownerName: string;
  email: string;
  password: string;
}): Promise<{ organizationId: string; userId: string }> {
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    throw new Error("A user with that email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const organization = await prisma.organization.create({
    data: {
      name: organizationName,
      users: {
        create: {
          name: ownerName,
          email,
          passwordHash,
          role: "OWNER",
        },
      },
    },
    include: { users: true },
  });

  return { organizationId: organization.id, userId: organization.users[0].id };
}
