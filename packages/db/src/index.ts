import { PrismaClient } from "@prisma/client";

if (typeof process !== "undefined" && process.versions?.node) {
  // dotenv/config's side effect (loading .env into process.env) is only needed
  // under Node (vitest, the worker process, Prisma CLI) — this shared module is
  // also pulled into Next.js's Edge-bundled middleware via apps/web/src/lib/auth.ts,
  // where process.argv is undefined and dotenv's internal CLI-arg parsing throws.
  require("dotenv/config");
}

export const prisma = new PrismaClient();
export * from "@prisma/client";
export * from "./scopedClient";
export * from "./invoiceStatus";
export * from "./emailSender";
