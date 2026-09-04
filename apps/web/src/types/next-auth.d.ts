import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      organizationId: string;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string;
    role?: string;
  }
}
