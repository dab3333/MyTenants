# MyTenants Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the MyTenants monorepo with the full v1 data schema, org-scoped multi-tenancy enforcement, working signup/login auth, a Docker Compose deployment skeleton, and an authenticated dashboard shell — a foundation later plans (buildings, tenants, payments, notifications, dashboard) build directly on top of.

**Architecture:** pnpm monorepo — `apps/web` (Next.js 15 App Router, TypeScript), `apps/worker` (Node cron skeleton, unused until the payments/notifications plans), `packages/db` (Prisma schema + generated client + the org-scoping extension), all sharing one Postgres database. Deployed as a single `docker-compose.yml` stack (`web`, `worker`, `postgres`, `caddy`) on one VPS.

**Tech Stack:** Next.js 15, TypeScript, Prisma, PostgreSQL, Auth.js (NextAuth v5), bcrypt, Vitest, Playwright, Docker Compose, Caddy.

**Spec:** `docs/superpowers/specs/2026-09-04-mytenants-design.md`

## Global Constraints

- Node.js >= 20, pnpm as the package manager (no npm/yarn lockfiles).
- TypeScript strict mode everywhere (`"strict": true`).
- Next.js App Router only — no `pages/` directory.
- Prisma is the sole DB access layer — no raw SQL except inside the org-scoping extension itself.
- Every table except `Organization` carries a direct `organizationId` column (per spec §4/§5), even where it's also reachable via a parent relation — this is what lets the scoping extension enforce isolation centrally without joins.
- Org-scoped models (everything except `Organization`) must be queried via `findFirst`/`findFirstOrThrow`/`findMany`, never `findUnique` — the scoping extension cannot safely rewrite a `findUnique` where-clause (Prisma requires unique-indexed fields there), so it throws if `findUnique` is called on a scoped model.
- No online/gateway payments, no multi-role permissions, no bed-level occupancy, no tenant-facing UI, no SMS/push — all explicit v1 non-goals per spec §9. Do not build ahead of them.
- Deployment artifact is Docker Compose only — no Kubernetes manifests, no separate infra-as-code.

---

## Task 1: Monorepo & Workspace Scaffold

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/vitest.config.ts`
- Create: `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/src/index.ts`
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`
- Create: `.gitignore`
- Test: `apps/web/src/lib/__tests__/sanity.test.ts`

**Interfaces:**
- Produces: a working `pnpm install`, `pnpm --filter web dev`, `pnpm --filter web test`, `pnpm --filter web build` at the repo root. Later tasks assume these scripts exist.

- [ ] **Step 1: Create root workspace files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`package.json` (root):
```json
{
  "name": "mytenants",
  "private": true,
  "engines": { "node": ">=20" },
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm --filter web build",
    "test": "pnpm --filter web test && pnpm --filter db test"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

`.gitignore`:
```
node_modules
.next
dist
.env
.env.local
*.log
```

- [ ] **Step 2: Scaffold `packages/db`**

`packages/db/package.json`:
```json
{
  "name": "@mytenants/db",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0"
  },
  "devDependencies": {
    "prisma": "^5.20.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/db/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src"]
}
```

- [ ] **Step 3: Scaffold `apps/worker`**

`apps/worker/package.json`:
```json
{
  "name": "@mytenants/worker",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc"
  },
  "dependencies": {
    "@mytenants/db": "workspace:*",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

`apps/worker/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src"]
}
```

`apps/worker/src/index.ts`:
```ts
console.log("worker starting (no scheduled jobs yet — added in the payments/notifications plan)");
```

- [ ] **Step 4: Scaffold `apps/web`**

`apps/web/package.json`:
```json
{
  "name": "@mytenants/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@mytenants/db": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-auth": "5.0.0-beta.25",
    "bcryptjs": "^2.4.3",
    "recharts": "^2.13.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/react": "^19.0.0",
    "@types/node": "^20.14.0",
    "@types/bcryptjs": "^2.4.6",
    "vitest": "^2.1.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@playwright/test": "^1.48.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["dom", "ES2022"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "next-env.d.ts"]
}
```

`apps/web/next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "node" },
});
```

`apps/web/src/app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`apps/web/src/app/page.tsx`:
```tsx
export default function HomePage() {
  return <main>MyTenants</main>;
}
```

- [ ] **Step 5: Write the sanity test**

`apps/web/src/lib/__tests__/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("workspace bootstrap", () => {
  it("runs a test through the vitest pipeline", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Install dependencies and run the test**

Run: `pnpm install && pnpm --filter web test`
Expected: PASS (1 test), confirming the workspace, TypeScript config, and Vitest pipeline all work together.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore apps packages pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo (web, worker, db packages)"
```

---

## Task 2: Prisma Schema — Full v1 Data Model

**Files:**
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/.env.example`
- Test: `packages/db/src/__tests__/schema.integration.test.ts`

**Interfaces:**
- Consumes: `@prisma/client` from Task 1.
- Produces: `export { prisma } from "@mytenants/db"` — a plain (unscoped) `PrismaClient` singleton, and all Prisma model types (`Organization`, `User`, `Building`, `Floor`, `Room`, `Tenant`, `Tenancy`, `Invoice`, `Payment`, `Notification`, `NotificationRecipient`) plus their enums (`UserRole`, `TenantStatus`, `TenancyStatus`, `InvoiceStatus`, `PaymentMethod`, `NotificationScope`, `NotificationTrigger`, `DeliveryStatus`), importable as `import { prisma, type Room, TenantStatus } from "@mytenants/db"`. Task 3 wraps this same client in an org-scoping extension.

- [ ] **Step 1: Start a local Postgres for development/testing**

Run: `docker run --name mytenants-postgres -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=mytenants -p 5432:5432 -d postgres:16`

`packages/db/.env.example`:
```
DATABASE_URL="postgresql://postgres:devpass@localhost:5432/mytenants"
```

Copy it to `packages/db/.env` (not committed) with the same value for local development.

- [ ] **Step 2: Write the full schema**

`packages/db/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())

  users         User[]
  buildings     Building[]
  tenants       Tenant[]
  notifications Notification[]
}

enum UserRole {
  OWNER
}

model User {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  email          String   @unique
  passwordHash   String
  name           String
  role           UserRole @default(OWNER)
  createdAt      DateTime @default(now())

  recordedPayments Payment[]

  @@index([organizationId])
}

model Building {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String
  address        String?
  createdAt      DateTime @default(now())

  floors Floor[]

  @@index([organizationId])
}

model Floor {
  id             String   @id @default(cuid())
  organizationId String
  buildingId     String
  building       Building @relation(fields: [buildingId], references: [id])
  label          String
  createdAt      DateTime @default(now())

  rooms Room[]

  @@index([organizationId])
  @@index([buildingId])
}

model Room {
  id             String  @id @default(cuid())
  organizationId String
  floorId        String
  floor          Floor   @relation(fields: [floorId], references: [id])
  name           String
  capacity       Int
  monthlyRate    Decimal @db.Decimal(10, 2)
  createdAt      DateTime @default(now())

  tenancies Tenancy[]

  @@index([organizationId])
  @@index([floorId])
}

enum TenantStatus {
  PROSPECT
  ACTIVE
  MOVED_OUT
}

model Tenant {
  id               String       @id @default(cuid())
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id])
  firstName        String
  lastName         String
  email            String?
  phone            String?
  emergencyContact String?
  status           TenantStatus @default(PROSPECT)
  createdAt        DateTime     @default(now())

  tenancies              Tenancy[]
  notificationRecipients NotificationRecipient[]

  @@index([organizationId])
}

enum TenancyStatus {
  ACTIVE
  ENDED
}

model Tenancy {
  id             String        @id @default(cuid())
  organizationId String
  tenantId       String
  tenant         Tenant        @relation(fields: [tenantId], references: [id])
  roomId         String
  room           Room          @relation(fields: [roomId], references: [id])
  startDate      DateTime
  endDate        DateTime?
  monthlyRate    Decimal       @db.Decimal(10, 2)
  depositAmount  Decimal       @db.Decimal(10, 2)
  status         TenancyStatus @default(ACTIVE)
  createdAt      DateTime      @default(now())

  invoices Invoice[]

  @@index([organizationId])
  @@index([tenantId])
  @@index([roomId])
}

enum InvoiceStatus {
  PENDING
  PARTIAL
  PAID
  OVERDUE
}

model Invoice {
  id             String        @id @default(cuid())
  organizationId String
  tenancyId      String
  tenancy        Tenancy       @relation(fields: [tenancyId], references: [id])
  periodStart    DateTime
  periodEnd      DateTime
  amountDue      Decimal       @db.Decimal(10, 2)
  dueDate        DateTime
  status         InvoiceStatus @default(PENDING)
  createdAt      DateTime      @default(now())

  payments Payment[]

  @@index([organizationId])
  @@index([tenancyId])
}

enum PaymentMethod {
  CASH
  BANK_TRANSFER
  GCASH
  OTHER
}

model Payment {
  id               String        @id @default(cuid())
  organizationId   String
  invoiceId        String
  invoice          Invoice       @relation(fields: [invoiceId], references: [id])
  amountPaid       Decimal       @db.Decimal(10, 2)
  method           PaymentMethod
  paidAt           DateTime      @default(now())
  recordedByUserId String
  recordedBy       User          @relation(fields: [recordedByUserId], references: [id])
  notes            String?
  createdAt        DateTime      @default(now())

  @@index([organizationId])
  @@index([invoiceId])
}

enum NotificationScope {
  ALL
  BUILDING
  ROOM
  TENANT
}

enum NotificationTrigger {
  MANUAL
  AUTO_REMINDER
}

model Notification {
  id             String              @id @default(cuid())
  organizationId String
  organization   Organization        @relation(fields: [organizationId], references: [id])
  subject        String
  body           String
  scope          NotificationScope
  trigger        NotificationTrigger
  sentAt         DateTime            @default(now())

  recipients NotificationRecipient[]

  @@index([organizationId])
}

enum DeliveryStatus {
  SENT
  FAILED
}

model NotificationRecipient {
  id             String         @id @default(cuid())
  organizationId String
  notificationId String
  notification   Notification   @relation(fields: [notificationId], references: [id])
  tenantId       String
  tenant         Tenant         @relation(fields: [tenantId], references: [id])
  deliveryStatus DeliveryStatus @default(SENT)

  @@index([organizationId])
  @@index([notificationId])
}
```

- [ ] **Step 3: Create the unscoped client export**

`packages/db/src/index.ts`:
```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export * from "@prisma/client";
```

- [ ] **Step 4: Write the failing integration test**

`packages/db/src/__tests__/schema.integration.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../index";

describe("schema relations", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a full org -> building -> floor -> room -> tenant -> tenancy -> invoice -> payment chain", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme Dorms" } });
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `owner-${org.id}@example.com`,
        passwordHash: "hash",
        name: "Owner",
      },
    });
    const building = await prisma.building.create({
      data: { organizationId: org.id, name: "Main Hall" },
    });
    const floor = await prisma.floor.create({
      data: { organizationId: org.id, buildingId: building.id, label: "1F" },
    });
    const room = await prisma.room.create({
      data: {
        organizationId: org.id,
        floorId: floor.id,
        name: "101",
        capacity: 2,
        monthlyRate: "3000.00",
      },
    });
    const tenant = await prisma.tenant.create({
      data: {
        organizationId: org.id,
        firstName: "Jane",
        lastName: "Doe",
        status: "ACTIVE",
      },
    });
    const tenancy = await prisma.tenancy.create({
      data: {
        organizationId: org.id,
        tenantId: tenant.id,
        roomId: room.id,
        startDate: new Date("2026-01-01"),
        monthlyRate: "3000.00",
        depositAmount: "3000.00",
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        tenancyId: tenancy.id,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        amountDue: "3000.00",
        dueDate: new Date("2026-01-05"),
      },
    });
    const payment = await prisma.payment.create({
      data: {
        organizationId: org.id,
        invoiceId: invoice.id,
        amountPaid: "3000.00",
        method: "CASH",
        recordedByUserId: user.id,
      },
    });

    expect(payment.invoiceId).toBe(invoice.id);

    const fetchedInvoice = await prisma.invoice.findFirst({
      where: { id: invoice.id },
      include: { payments: true },
    });
    expect(fetchedInvoice?.payments).toHaveLength(1);
  });
});
```

- [ ] **Step 5: Run the migration and confirm the test fails first (no tables yet)**

Run: `cd packages/db && pnpm prisma migrate dev --name init`
This creates the tables. Then temporarily verify the test-first discipline by checking the test would have failed against an empty/no-client state — since `prisma migrate dev` also runs generate, run the test now:

Run: `pnpm --filter db test`
Expected: PASS — the migration created all tables so the chain-creation test passes. (If you want to see it fail first, drop the DB with `pnpm prisma migrate reset` before Step 2's migration — the ordering here is: schema authored, migrated, then verified.)

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma packages/db/src packages/db/.env.example
git commit -m "feat(db): add full v1 Prisma schema and relation integration test"
```

---

## Task 3: Org-Scoping Prisma Client Extension

**Files:**
- Create: `packages/db/src/scopedClient.ts`
- Test: `packages/db/src/__tests__/scopedClient.test.ts`

**Interfaces:**
- Consumes: `prisma` from `packages/db/src/index.ts` (Task 2).
- Produces: `export function createScopedClient(organizationId: string)` returning a Prisma Client instance whose `.building`, `.floor`, `.room`, `.tenant`, `.tenancy`, `.invoice`, `.payment`, `.notification`, `.notificationRecipient`, and `.user` model delegates auto-filter/auto-stamp `organizationId`. Every later task's route handlers call `createScopedClient(session.organizationId)` instead of importing `prisma` directly for these models.

- [ ] **Step 1: Write the failing tests**

`packages/db/src/__tests__/scopedClient.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter db test`
Expected: FAIL with `Cannot find module '../scopedClient'` (module doesn't exist yet).

- [ ] **Step 3: Implement the extension**

`packages/db/src/scopedClient.ts`:
```ts
import { prisma } from "./index";

const SCOPED_MODELS = new Set([
  "user",
  "building",
  "floor",
  "room",
  "tenant",
  "tenancy",
  "invoice",
  "payment",
  "notification",
  "notificationRecipient",
]);

const READ_OPS = new Set(["findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);
const WRITE_WHERE_OPS = new Set(["update", "updateMany", "delete", "deleteMany"]);
const CREATE_OPS = new Set(["create", "createMany"]);

export function createScopedClient(organizationId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
          if (!SCOPED_MODELS.has(modelKey)) {
            return query(args);
          }

          if (operation === "findUnique" || operation === "findUniqueOrThrow") {
            throw new Error(
              `findUnique is not allowed on org-scoped models (model: ${model}). Use findFirst/findFirstOrThrow with an explicit id filter instead.`
            );
          }

          if (READ_OPS.has(operation) || WRITE_WHERE_OPS.has(operation)) {
            args.where = { ...(args.where ?? {}), organizationId };
          }

          if (CREATE_OPS.has(operation)) {
            if (operation === "create") {
              args.data = { ...(args.data ?? {}), organizationId };
            } else {
              args.data = Array.isArray(args.data)
                ? args.data.map((row: Record<string, unknown>) => ({ ...row, organizationId }))
                : args.data;
            }
          }

          return query(args);
        },
      },
    },
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter db test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/scopedClient.ts packages/db/src/__tests__/scopedClient.test.ts
git commit -m "feat(db): add org-scoping Prisma client extension"
```

---

## Task 4: Auth — Signup & Login

**Files:**
- Create: `apps/web/src/lib/registerOrganization.ts`
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/src/app/api/signup/route.ts`
- Create: `apps/web/src/app/signup/page.tsx`
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/.env.example`
- Test: `apps/web/src/lib/__tests__/registerOrganization.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@mytenants/db` (Task 2), `createScopedClient` from `@mytenants/db` (Task 3, used by later plans — not this task, since registration itself creates the Organization, which is unscoped by definition).
- Produces: `registerOrganization({ organizationName, ownerName, email, password }): Promise<{ organizationId: string; userId: string }>` — used by the signup API route and reusable by later plans' seed scripts/tests. Produces a working NextAuth session shape: `session.user.organizationId: string`, `session.user.role: "OWNER"`, `session.user.id: string` — later tasks read `session.user.organizationId` to build a scoped client.

- [ ] **Step 1: Write the failing test for the registration function**

`apps/web/src/lib/__tests__/registerOrganization.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web test`
Expected: FAIL with `Cannot find module '../registerOrganization'`.

- [ ] **Step 3: Implement `registerOrganization`**

`apps/web/src/lib/registerOrganization.ts`:
```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web test`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire up NextAuth**

`apps/web/.env.example`:
```
DATABASE_URL="postgresql://postgres:devpass@localhost:5432/mytenants"
AUTH_SECRET="replace-with-a-random-32-byte-value"
```

`apps/web/src/lib/auth.ts`:
```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@mytenants/db";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findFirst({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          organizationId: user.organizationId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.organizationId = (user as { organizationId: string }).organizationId;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.organizationId = token.organizationId as string;
      session.user.role = token.role as string;
      session.user.id = token.sub as string;
      return session;
    },
  },
  pages: { signIn: "/login" },
});
```

`apps/web/src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 6: Signup API route and page**

`apps/web/src/app/api/signup/route.ts`:
```ts
import { NextResponse } from "next/server";
import { registerOrganization } from "@/lib/registerOrganization";

export async function POST(request: Request) {
  const body = await request.json();
  try {
    const result = await registerOrganization({
      organizationName: body.organizationName,
      ownerName: body.ownerName,
      email: body.email,
      password: body.password,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signup failed" },
      { status: 400 }
    );
  }
}
```

`apps/web/src/app/signup/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationName, ownerName, email, password }),
    });
    if (res.ok) {
      router.push("/login");
    } else {
      const data = await res.json();
      setError(data.error ?? "Signup failed");
    }
  }

  return (
    <main>
      <h1>Create your organization</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Organization name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
        <input placeholder="Your name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Sign up</button>
      </form>
    </main>
  );
}
```

`apps/web/src/app/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <main>
      <h1>Log in</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Log in</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Run all web tests to confirm nothing broke**

Run: `pnpm --filter web test`
Expected: PASS (sanity test + 2 registerOrganization tests).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib apps/web/src/app/api apps/web/src/app/signup apps/web/src/app/login apps/web/.env.example
git commit -m "feat(web): add signup and NextAuth credentials login"
```

---

## Task 5: Authenticated Dashboard Shell & Route Guard

**Files:**
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/app/dashboard/page.tsx`
- Create: `apps/web/src/app/dashboard/layout.tsx`
- Create: `apps/web/e2e/auth.spec.ts`
- Create: `apps/web/playwright.config.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth` (Task 4).
- Produces: `/dashboard` as the base route later plans add pages under (`/dashboard/buildings`, `/dashboard/tenants`, `/dashboard/payments`, `/dashboard/notifications`), already guarded by the middleware so later plans don't need to re-implement auth checks.

- [ ] **Step 1: Add the route guard middleware**

`apps/web/src/middleware.ts`:
```ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard");

  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

- [ ] **Step 2: Add the dashboard shell**

`apps/web/src/app/dashboard/layout.tsx`:
```tsx
import { auth } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div>
      <header>
        <span>MyTenants</span>
        <span>{session?.user?.name}</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

`apps/web/src/app/dashboard/page.tsx`:
```tsx
export default function DashboardHomePage() {
  return (
    <section>
      <h1>Dashboard</h1>
      <p>Buildings, tenants, payments, and notifications will appear here in later releases.</p>
    </section>
  );
}
```

- [ ] **Step 3: Configure Playwright**

`apps/web/playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: true,
  },
  use: { baseURL: "http://localhost:3000" },
});
```

- [ ] **Step 4: Write the failing E2E test**

`apps/web/e2e/auth.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("redirects an unauthenticated visitor from /dashboard to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("signup then login reaches the dashboard shell", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByPlaceholder("Organization name").fill("E2E Dorms");
  await page.getByPlaceholder("Your name").fill("E2E Owner");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Dashboard")).toBeVisible();
});
```

- [ ] **Step 5: Run the E2E tests to verify they fail, then pass**

Run: `pnpm --filter web exec playwright install --with-deps chromium` (one-time browser install)
Run: `pnpm --filter web test:e2e`
Expected: initially FAIL if `/dashboard`, `/login`, or `/signup` are missing/misconfigured; after Steps 1-2 are in place, PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/app/dashboard apps/web/e2e apps/web/playwright.config.ts
git commit -m "feat(web): add dashboard shell with auth-guarded middleware and e2e coverage"
```

---

## Task 6: Docker Compose Deployment Skeleton

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `apps/worker/Dockerfile`
- Create: `docker-compose.yml`
- Create: `Caddyfile`
- Create: `.env.example` (root, deployment-level)

**Interfaces:**
- Consumes: `apps/web` and `apps/worker` build scripts (Tasks 1, 4, 5).
- Produces: a deployable stack — `docker compose up -d --build` starts `postgres`, runs `web`'s `prisma migrate deploy` on boot, then serves the app behind `caddy`. Later plans do not need to touch these files unless they add a new service.

- [ ] **Step 1: Web Dockerfile**

`apps/web/Dockerfile`:
```dockerfile
FROM node:20-alpine AS base
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN pnpm install --frozen-lockfile

COPY packages/db packages/db
COPY apps/web apps/web
RUN pnpm --filter db prisma:generate
RUN pnpm --filter web build

EXPOSE 3000
CMD sh -c "pnpm --filter db exec prisma migrate deploy && pnpm --filter web start"
```

- [ ] **Step 2: Worker Dockerfile**

`apps/worker/Dockerfile`:
```dockerfile
FROM node:20-alpine AS base
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN pnpm install --frozen-lockfile

COPY packages/db packages/db
COPY apps/worker apps/worker
RUN pnpm --filter db prisma:generate
RUN pnpm --filter worker build

CMD ["node", "apps/worker/dist/index.js"]
```

- [ ] **Step 3: Compose file, Caddyfile, and root env example**

`docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: mytenants
    volumes:
      - postgres_data:/var/lib/postgresql/data

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/mytenants
      AUTH_SECRET: ${AUTH_SECRET}
    depends_on:
      - postgres

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/mytenants
    depends_on:
      - postgres

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - web

volumes:
  postgres_data:
  caddy_data:
```

`Caddyfile`:
```
{$DOMAIN:localhost} {
  reverse_proxy web:3000
}
```

`.env.example` (root):
```
POSTGRES_PASSWORD=changeme
AUTH_SECRET=replace-with-a-random-32-byte-value
DOMAIN=your-domain.example.com
```

- [ ] **Step 4: Validate the compose file**

Run: `docker compose config`
Expected: prints the fully-resolved compose configuration with no errors (confirms YAML validity and variable interpolation).

Run: `docker compose build`
Expected: both `web` and `worker` images build successfully with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/Dockerfile apps/worker/Dockerfile docker-compose.yml Caddyfile .env.example
git commit -m "feat(deploy): add Docker Compose stack (web, worker, postgres, caddy)"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Architecture (§2), tech stack (§3), multi-tenancy/isolation (§4), and the full core data model (§5) are all implemented. Feature behavior (§6), branding (§7), and expansion points (§8) are intentionally deferred to later plans — this plan only lays the foundation they build on. Deployment (§10) is covered by Task 6. Testing strategy (§11) is seeded (Vitest + Playwright wired up) though most business-logic tests arrive with their features in later plans.
- **Non-goals respected:** no payment gateway, no multi-role permissions, no bed-level tracking, no tenant portal, no SMS — nothing in this plan touches those.
- **Type consistency:** `organizationId`, model names, and enum values are identical across Task 2's schema, Task 3's scoped client, and Task 4/5's auth code.
