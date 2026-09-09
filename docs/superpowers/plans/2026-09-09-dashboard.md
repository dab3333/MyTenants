# Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/dashboard` placeholder with an org-scoped, date-range-filterable overview of four widgets — monthly income trend, active tenant count over time, current occupancy rate per building, and current overdue payments (count + amount).

**Architecture:** Two new pure/DB-backed modules in `apps/web/src/lib` (`dateRange.ts` for range resolution and month bucketing, `dashboardMetrics.ts` for the four widgets' data), five new presentational/client components, and a rewritten `apps/web/src/app/dashboard/page.tsx` that reads the range from `searchParams`, computes everything via `createScopedClient`, and renders. No new database schema, no new API routes — the page is a server component, matching the existing `/dashboard/tenants`/`/dashboard/payments` filter pattern exactly.

**Tech Stack:** Next.js 15 (App Router), Prisma, Recharts (already installed, first real usage), Vitest, Playwright — same stack as every prior plan, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-09-dashboard-design.md` (full design)
**Parent spec:** `docs/superpowers/specs/2026-09-04-mytenants-design.md` (§6.6, §11 Testing Strategy)
**Constraints:** `docs/superpowers/specs/2026-09-04-foundation-constraints.md` — org-scoping (§1) is binding; §2 (no nested writes) and §3 (parent-FK validation) do not apply since this plan performs no writes and takes no user-supplied parent ids.

## Global Constraints

- Every query goes through `createScopedClient(session.user.organizationId)` — never the unscoped `prisma` export (this is a per-organization dashboard, unlike the worker's intentionally cross-org batch jobs).
- Org-scoped models are queried via `findFirst`/`findMany`/`groupBy`, never `findUnique`.
- All date math is UTC-anchored (`Date.UTC(...)` / `getUTCFullYear()`/`getUTCMonth()`/`getUTCDate()`), no per-organization timezone setting — same convention as `computeInvoiceStatus` and the worker's reminder job.
- No new database schema, columns, or migrations. No new API routes.
- Dashboard pages authenticate the same way every other dashboard server-component page already does: `const session = await auth(); if (!session?.user?.organizationId) redirect("/login");` (not `requireOrgSession()`, which is the API-route-specific helper).
- Every `Prisma.Decimal` is converted to a plain `number` via `Number(...)` before arithmetic, matching `payments/page.tsx` and `invoices/[id]/page.tsx`.
- An invalid, incomplete, or reversed custom date range (`preset=custom` with a missing/unparseable/`from > to` `from`/`to`) silently falls back to the `"6m"` default — no error page, matching how an invalid `?status=` value elsewhere in this app is already silently ignored.
- Every form `<input>`/`<select>` is wrapped inside its own `<label>` (not a sibling pair) so `page.getByLabel(...)` resolves it in Playwright.

---

## Task 1: Date-range resolution & month bucketing (`apps/web/src/lib/dateRange.ts`)

**Files:**
- Create: `apps/web/src/lib/dateRange.ts`
- Create: `apps/web/src/lib/__tests__/dateRange.test.ts`

**Interfaces:**
- Produces: `DateRange = { from: Date; to: Date }`, `MonthBucket = { label: string; bucketEnd: Date }`, `DATE_RANGE_PRESETS = ["6m", "12m", "ytd", "custom"] as const`, `resolveDateRange(preset: string | undefined, from: string | undefined, to: string | undefined, today: Date): DateRange`, `buildMonthBuckets(range: DateRange): MonthBucket[]` — all consumed by Task 2 (`dashboardMetrics.ts`) and Task 4 (`page.tsx`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/__tests__/dateRange.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveDateRange, buildMonthBuckets } from "../dateRange";

describe("resolveDateRange", () => {
  const today = new Date("2026-09-09T00:00:00.000Z");

  it("defaults to the last 6 calendar months when preset is absent", () => {
    const range = resolveDateRange(undefined, undefined, undefined, today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(range.to.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("resolves the 12m preset to 12 calendar months back", () => {
    const range = resolveDateRange("12m", undefined, undefined, today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2025-10-01");
    expect(range.to.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("resolves the ytd preset to January 1st of the current year", () => {
    const range = resolveDateRange("ytd", undefined, undefined, today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(range.to.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("resolves a valid custom range from the given from/to", () => {
    const range = resolveDateRange("custom", "2026-02-01", "2026-05-15", today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(range.to.toISOString().slice(0, 10)).toBe("2026-05-15");
  });

  it("falls back to the 6-month default when custom 'from' is missing", () => {
    const range = resolveDateRange("custom", undefined, "2026-05-15", today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(range.to.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("falls back to the 6-month default when custom 'from' is after 'to'", () => {
    const range = resolveDateRange("custom", "2026-06-01", "2026-01-01", today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("falls back to the 6-month default when custom dates are unparseable", () => {
    const range = resolveDateRange("custom", "not-a-date", "2026-05-15", today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("falls back to the 6-month default for an unrecognized preset", () => {
    const range = resolveDateRange("not-a-preset", undefined, undefined, today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-04-01");
  });
});

describe("buildMonthBuckets", () => {
  const today = new Date("2026-09-09T00:00:00.000Z");

  it("builds one bucket per full month plus a truncated final bucket ending at 'to'", () => {
    const range = resolveDateRange("6m", undefined, undefined, today);
    const buckets = buildMonthBuckets(range);

    expect(buckets.map((b) => b.label)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(buckets[0].bucketEnd.toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(buckets[4].bucketEnd.toISOString().slice(0, 10)).toBe("2026-08-31");
    expect(buckets[5].bucketEnd.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("builds a single bucket when from and to fall in the same month", () => {
    const range = { from: new Date("2026-09-01T00:00:00.000Z"), to: new Date("2026-09-09T00:00:00.000Z") };
    const buckets = buildMonthBuckets(range);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].label).toBe("2026-09");
    expect(buckets[0].bucketEnd.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("handles a range spanning a year boundary", () => {
    const range = { from: new Date("2025-11-01T00:00:00.000Z"), to: new Date("2026-01-15T00:00:00.000Z") };
    const buckets = buildMonthBuckets(range);
    expect(buckets.map((b) => b.label)).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(buckets[0].bucketEnd.toISOString().slice(0, 10)).toBe("2025-11-30");
    expect(buckets[1].bucketEnd.toISOString().slice(0, 10)).toBe("2025-12-31");
    expect(buckets[2].bucketEnd.toISOString().slice(0, 10)).toBe("2026-01-15");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test -- dateRange`
Expected: FAIL with "Cannot find module '../dateRange'".

- [ ] **Step 3: Implement `dateRange.ts`**

Create `apps/web/src/lib/dateRange.ts`:

```ts
export type DateRange = { from: Date; to: Date };
export type MonthBucket = { label: string; bucketEnd: Date };

export const DATE_RANGE_PRESETS = ["6m", "12m", "ytd", "custom"] as const;

function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function monthsBeforeMonthStart(date: Date, monthsBack: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 1));
}

function parseUTCDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function resolveDateRange(
  preset: string | undefined,
  from: string | undefined,
  to: string | undefined,
  today: Date
): DateRange {
  const end = startOfUTCDay(today);
  const defaultRange: DateRange = { from: monthsBeforeMonthStart(end, 5), to: end };

  if (preset === "custom") {
    const parsedFrom = parseUTCDate(from);
    const parsedTo = parseUTCDate(to);
    if (parsedFrom && parsedTo && parsedFrom.getTime() <= parsedTo.getTime()) {
      return { from: parsedFrom, to: parsedTo };
    }
    return defaultRange;
  }

  if (preset === "12m") {
    return { from: monthsBeforeMonthStart(end, 11), to: end };
  }

  if (preset === "ytd") {
    return { from: new Date(Date.UTC(end.getUTCFullYear(), 0, 1)), to: end };
  }

  return defaultRange;
}

export function buildMonthBuckets(range: DateRange): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  let year = range.from.getUTCFullYear();
  let month = range.from.getUTCMonth();
  const toYear = range.to.getUTCFullYear();
  const toMonth = range.to.getUTCMonth();

  while (year < toYear || (year === toYear && month <= toMonth)) {
    const isLastBucket = year === toYear && month === toMonth;
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const bucketEnd = isLastBucket && range.to.getTime() < monthEnd.getTime() ? range.to : monthEnd;
    const label = `${year}-${String(month + 1).padStart(2, "0")}`;
    buckets.push({ label, bucketEnd });

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return buckets;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test -- dateRange`
Expected: PASS — all `dateRange.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/dateRange.ts apps/web/src/lib/__tests__/dateRange.test.ts
git commit -m "feat(web): add date-range resolution and month bucketing for the dashboard"
```

---

## Task 2: Income & tenant-count trend metrics (`apps/web/src/lib/dashboardMetrics.ts`)

**Files:**
- Create: `apps/web/src/lib/dashboardMetrics.ts`
- Create: `apps/web/src/lib/__tests__/dashboardMetrics.test.ts`

**Interfaces:**
- Consumes: `DateRange`, `MonthBucket`, `buildMonthBuckets` (Task 1).
- Produces: `IncomeTrendPoint = { label: string; totalPaid: number }`, `TenantCountPoint = { label: string; activeTenantCount: number }`, `getIncomeTrend(scoped, range: DateRange, buckets: MonthBucket[]): Promise<IncomeTrendPoint[]>`, `getTenantCountTrend(scoped, buckets: MonthBucket[]): Promise<TenantCountPoint[]>` — consumed by Task 4 (`page.tsx`). Task 3 adds two more exports to this same file.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/__tests__/dashboardMetrics.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma, createScopedClient } from "@mytenants/db";
import { buildMonthBuckets } from "../dateRange";
import { getIncomeTrend, getTenantCountTrend } from "../dashboardMetrics";

async function makeUser(organizationId: string) {
  return prisma.user.create({
    data: { organizationId, email: `u-${Math.random()}@example.com`, passwordHash: "x", name: "U" },
  });
}

async function makeTenancy(organizationId: string, options: { startDate: string; endDate?: string }) {
  const building = await prisma.building.create({ data: { organizationId, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId, buildingId: building.id, label: "1F" } });
  const room = await prisma.room.create({
    data: { organizationId, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
  });
  const tenant = await prisma.tenant.create({
    data: { organizationId, firstName: "A", lastName: "Tenant", status: "ACTIVE" },
  });
  const tenancy = await prisma.tenancy.create({
    data: {
      organizationId,
      tenantId: tenant.id,
      roomId: room.id,
      startDate: new Date(options.startDate),
      endDate: options.endDate ? new Date(options.endDate) : null,
      monthlyRate: "3000.00",
      depositAmount: "3000.00",
      status: options.endDate ? "ENDED" : "ACTIVE",
    },
  });
  return { tenant, tenancy, room };
}

describe("getIncomeTrend", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("sums payments per month within the range, excluding payments outside it", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Income ${Math.random()}` } });
    const { tenancy } = await makeTenancy(org.id, { startDate: "2026-01-01" });
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        tenancyId: tenancy.id,
        periodStart: new Date("2026-04-01"),
        periodEnd: new Date("2026-04-30"),
        amountDue: "3000.00",
        dueDate: new Date("2026-04-01"),
        status: "PAID",
      },
    });
    const user = await makeUser(org.id);
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: invoice.id, amountPaid: "1000.00", method: "CASH", paidAt: new Date("2026-04-10"), recordedByUserId: user.id },
    });
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: invoice.id, amountPaid: "2000.00", method: "CASH", paidAt: new Date("2026-05-05"), recordedByUserId: user.id },
    });
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: invoice.id, amountPaid: "500.00", method: "CASH", paidAt: new Date("2026-01-01"), recordedByUserId: user.id },
    });

    const scoped = createScopedClient(org.id);
    const range = { from: new Date("2026-04-01"), to: new Date("2026-05-31") };
    const buckets = buildMonthBuckets(range);

    const trend = await getIncomeTrend(scoped, range, buckets);

    expect(trend).toEqual([
      { label: "2026-04", totalPaid: 1000 },
      { label: "2026-05", totalPaid: 2000 },
    ]);
  });

  it("returns zero for a month with no payments", async () => {
    const org = await prisma.organization.create({ data: { name: `Org No Income ${Math.random()}` } });
    const scoped = createScopedClient(org.id);
    const range = { from: new Date("2026-04-01"), to: new Date("2026-04-30") };
    const buckets = buildMonthBuckets(range);

    const trend = await getIncomeTrend(scoped, range, buckets);

    expect(trend).toEqual([{ label: "2026-04", totalPaid: 0 }]);
  });
});

describe("getTenantCountTrend", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("counts a tenant active for the whole range in every bucket", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Count Whole ${Math.random()}` } });
    await makeTenancy(org.id, { startDate: "2026-01-01" });
    const scoped = createScopedClient(org.id);
    const buckets = buildMonthBuckets({ from: new Date("2026-04-01"), to: new Date("2026-06-30") });

    const trend = await getTenantCountTrend(scoped, buckets);

    expect(trend).toEqual([
      { label: "2026-04", activeTenantCount: 1 },
      { label: "2026-05", activeTenantCount: 1 },
      { label: "2026-06", activeTenantCount: 1 },
    ]);
  });

  it("excludes a tenant from buckets after their tenancy ended", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Count Ended ${Math.random()}` } });
    await makeTenancy(org.id, { startDate: "2026-01-01", endDate: "2026-05-15" });
    const scoped = createScopedClient(org.id);
    const buckets = buildMonthBuckets({ from: new Date("2026-04-01"), to: new Date("2026-06-30") });

    const trend = await getTenantCountTrend(scoped, buckets);

    expect(trend).toEqual([
      { label: "2026-04", activeTenantCount: 1 },
      { label: "2026-05", activeTenantCount: 1 },
      { label: "2026-06", activeTenantCount: 0 },
    ]);
  });

  it("excludes a tenant from buckets before their tenancy started", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Count Started Late ${Math.random()}` } });
    await makeTenancy(org.id, { startDate: "2026-05-20" });
    const scoped = createScopedClient(org.id);
    const buckets = buildMonthBuckets({ from: new Date("2026-04-01"), to: new Date("2026-06-30") });

    const trend = await getTenantCountTrend(scoped, buckets);

    expect(trend).toEqual([
      { label: "2026-04", activeTenantCount: 0 },
      { label: "2026-05", activeTenantCount: 1 },
      { label: "2026-06", activeTenantCount: 1 },
    ]);
  });

  it("counts a tenant once even with two overlapping tenancies in the same bucket", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Count Dedup ${Math.random()}` } });
    const { tenant, room } = await makeTenancy(org.id, { startDate: "2026-01-01" });
    // Same tenant, a second (e.g. transferred) tenancy overlapping the same period.
    await prisma.tenancy.create({
      data: {
        organizationId: org.id,
        tenantId: tenant.id,
        roomId: room.id,
        startDate: new Date("2026-02-01"),
        monthlyRate: "3000.00",
        depositAmount: "3000.00",
        status: "ACTIVE",
      },
    });
    const scoped = createScopedClient(org.id);
    const buckets = buildMonthBuckets({ from: new Date("2026-04-01"), to: new Date("2026-04-30") });

    const trend = await getTenantCountTrend(scoped, buckets);

    expect(trend).toEqual([{ label: "2026-04", activeTenantCount: 1 }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test -- dashboardMetrics`
Expected: FAIL with "Cannot find module '../dashboardMetrics'".

- [ ] **Step 3: Implement `dashboardMetrics.ts`**

Create `apps/web/src/lib/dashboardMetrics.ts`:

```ts
import type { createScopedClient } from "@mytenants/db";
import type { DateRange, MonthBucket } from "./dateRange";

export type IncomeTrendPoint = { label: string; totalPaid: number };
export type TenantCountPoint = { label: string; activeTenantCount: number };

export async function getIncomeTrend(
  scoped: ReturnType<typeof createScopedClient>,
  range: DateRange,
  buckets: MonthBucket[]
): Promise<IncomeTrendPoint[]> {
  const payments = await scoped.payment.findMany({
    where: { paidAt: { gte: range.from, lte: range.to } },
    select: { amountPaid: true, paidAt: true },
  });

  return buckets.map((bucket) => {
    const bucketStart = new Date(Date.UTC(bucket.bucketEnd.getUTCFullYear(), bucket.bucketEnd.getUTCMonth(), 1));
    const totalPaid = payments
      .filter((p) => p.paidAt.getTime() >= bucketStart.getTime() && p.paidAt.getTime() <= bucket.bucketEnd.getTime())
      .reduce((sum, p) => sum + Number(p.amountPaid), 0);
    return { label: bucket.label, totalPaid };
  });
}

export async function getTenantCountTrend(
  scoped: ReturnType<typeof createScopedClient>,
  buckets: MonthBucket[]
): Promise<TenantCountPoint[]> {
  const tenancies = await scoped.tenancy.findMany({
    select: { tenantId: true, startDate: true, endDate: true },
  });

  return buckets.map((bucket) => {
    const activeTenantIds = new Set(
      tenancies
        .filter(
          (t) =>
            t.startDate.getTime() <= bucket.bucketEnd.getTime() &&
            (t.endDate === null || t.endDate.getTime() > bucket.bucketEnd.getTime())
        )
        .map((t) => t.tenantId)
    );
    return { label: bucket.label, activeTenantCount: activeTenantIds.size };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test -- dashboardMetrics`
Expected: PASS — all `dashboardMetrics.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/dashboardMetrics.ts apps/web/src/lib/__tests__/dashboardMetrics.test.ts
git commit -m "feat(web): add income and tenant-count trend metrics for the dashboard"
```

---

## Task 3: Occupancy & overdue snapshot metrics

**Files:**
- Modify: `apps/web/src/lib/dashboardMetrics.ts` (add two more exports alongside Task 2's)
- Modify: `apps/web/src/lib/__tests__/dashboardMetrics.test.ts` (add two more `describe` blocks)

**Interfaces:**
- Produces: `BuildingOccupancy = { id: string; name: string; occupiedCapacity: number; totalCapacity: number }`, `OverdueSummary = { count: number; totalOwed: number }`, `getOccupancyByBuilding(scoped): Promise<BuildingOccupancy[]>`, `getOverdueSummary(scoped): Promise<OverdueSummary>` — both consumed by Task 4 (`page.tsx`).

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/lib/__tests__/dashboardMetrics.test.ts` (append these two `describe` blocks after `getTenantCountTrend`'s), and update the import line to also pull in the two new functions:

```ts
import { getIncomeTrend, getTenantCountTrend, getOccupancyByBuilding, getOverdueSummary } from "../dashboardMetrics";
```

```ts
describe("getOccupancyByBuilding", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("computes occupied and total capacity per building, across multiple rooms of varying capacity", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Occupancy ${Math.random()}` } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Main Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const fullRoom = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 2, monthlyRate: "3000.00" },
    });
    const vacantRoom = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "102", capacity: 1, monthlyRate: "3000.00" },
    });
    const tenant1 = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "One", status: "ACTIVE" } });
    const tenant2 = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "B", lastName: "Two", status: "ACTIVE" } });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant1.id, roomId: fullRoom.id, startDate: new Date("2026-01-01"), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant2.id, roomId: fullRoom.id, startDate: new Date("2026-01-01"), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });

    const scoped = createScopedClient(org.id);
    const result = await getOccupancyByBuilding(scoped);

    expect(result).toEqual([{ id: building.id, name: "Main Hall", occupiedCapacity: 2, totalCapacity: 3 }]);
  });

  it("ignores ENDED tenancies when computing occupied capacity", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Occupancy Ended ${Math.random()}` } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Ended Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
    });
    const tenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "One", status: "MOVED_OUT" } });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant.id, roomId: room.id, startDate: new Date("2026-01-01"), endDate: new Date("2026-02-01"), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ENDED" },
    });

    const scoped = createScopedClient(org.id);
    const result = await getOccupancyByBuilding(scoped);

    expect(result).toEqual([{ id: building.id, name: "Ended Hall", occupiedCapacity: 0, totalCapacity: 1 }]);
  });

  it("returns an empty array for an organization with no buildings", async () => {
    const org = await prisma.organization.create({ data: { name: `Org No Buildings ${Math.random()}` } });
    const scoped = createScopedClient(org.id);

    const result = await getOccupancyByBuilding(scoped);

    expect(result).toEqual([]);
  });
});

describe("getOverdueSummary", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("sums the remaining balance of OVERDUE invoices only, netting out partial payments", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Overdue ${Math.random()}` } });
    const { tenancy } = await makeTenancy(org.id, { startDate: "2026-01-01" });
    const overdueInvoice = await prisma.invoice.create({
      data: { organizationId: org.id, tenancyId: tenancy.id, periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), amountDue: "3000.00", dueDate: new Date("2026-01-01"), status: "OVERDUE" },
    });
    const user = await makeUser(org.id);
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: overdueInvoice.id, amountPaid: "1000.00", method: "CASH", recordedByUserId: user.id },
    });
    await prisma.invoice.create({
      data: { organizationId: org.id, tenancyId: tenancy.id, periodStart: new Date("2026-02-01"), periodEnd: new Date("2026-02-28"), amountDue: "3000.00", dueDate: new Date("2026-02-01"), status: "PAID" },
    });

    const scoped = createScopedClient(org.id);
    const result = await getOverdueSummary(scoped);

    expect(result).toEqual({ count: 1, totalOwed: 2000 });
  });

  it("returns a zero summary when there are no overdue invoices", async () => {
    const org = await prisma.organization.create({ data: { name: `Org No Overdue ${Math.random()}` } });
    const scoped = createScopedClient(org.id);

    const result = await getOverdueSummary(scoped);

    expect(result).toEqual({ count: 0, totalOwed: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test -- dashboardMetrics`
Expected: FAIL — `getOccupancyByBuilding`/`getOverdueSummary` are not exported from `../dashboardMetrics` yet.

- [ ] **Step 3: Add the two functions to `dashboardMetrics.ts`**

Append to `apps/web/src/lib/dashboardMetrics.ts` (after `getTenantCountTrend`):

```ts
export type BuildingOccupancy = { id: string; name: string; occupiedCapacity: number; totalCapacity: number };
export type OverdueSummary = { count: number; totalOwed: number };

export async function getOccupancyByBuilding(
  scoped: ReturnType<typeof createScopedClient>
): Promise<BuildingOccupancy[]> {
  const buildings = await scoped.building.findMany({
    orderBy: { name: "asc" },
    include: { floors: { include: { rooms: true } } },
  });
  if (buildings.length === 0) return [];

  const roomIds = buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms.map((r) => r.id)));
  const occupancyCounts = roomIds.length
    ? await scoped.tenancy.groupBy({
        by: ["roomId"],
        where: { roomId: { in: roomIds }, status: "ACTIVE" },
        _count: { _all: true },
      })
    : [];
  const occupiedByRoomId = new Map(occupancyCounts.map((row) => [row.roomId, row._count._all]));

  return buildings.map((building) => {
    const rooms = building.floors.flatMap((f) => f.rooms);
    const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
    const occupiedCapacity = rooms.reduce((sum, r) => sum + (occupiedByRoomId.get(r.id) ?? 0), 0);
    return { id: building.id, name: building.name, occupiedCapacity, totalCapacity };
  });
}

export async function getOverdueSummary(
  scoped: ReturnType<typeof createScopedClient>
): Promise<OverdueSummary> {
  const invoices = await scoped.invoice.findMany({
    where: { status: "OVERDUE" },
    include: { payments: true },
  });

  const totalOwed = invoices.reduce((sum, invoice) => {
    const totalPaid = invoice.payments.reduce((paidSum, p) => paidSum + Number(p.amountPaid), 0);
    return sum + (Number(invoice.amountDue) - totalPaid);
  }, 0);

  return { count: invoices.length, totalOwed };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test -- dashboardMetrics`
Expected: PASS — all `dashboardMetrics.test.ts` cases (both Task 2's and Task 3's) green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/dashboardMetrics.ts apps/web/src/lib/__tests__/dashboardMetrics.test.ts
git commit -m "feat(web): add occupancy and overdue snapshot metrics for the dashboard"
```

---

## Task 4: UI — filter form, widgets, and page assembly

**Files:**
- Create: `apps/web/src/app/dashboard/DashboardFilterForm.tsx`
- Create: `apps/web/src/app/dashboard/IncomeTrendChart.tsx`
- Create: `apps/web/src/app/dashboard/TenantCountChart.tsx`
- Create: `apps/web/src/app/dashboard/OccupancyByBuilding.tsx`
- Create: `apps/web/src/app/dashboard/OverdueSummary.tsx`
- Modify: `apps/web/src/app/dashboard/page.tsx` (replace the placeholder entirely)

**Interfaces:**
- Consumes: `DATE_RANGE_PRESETS`, `resolveDateRange`, `buildMonthBuckets` (Task 1); `getIncomeTrend`, `getTenantCountTrend`, `getOccupancyByBuilding`, `getOverdueSummary` and their point/summary types (Tasks 2–3).
- Produces: the `/dashboard` page, exercised by Task 5's e2e test (`data-testid="occupancy-row"`, `data-testid="overdue-count"`, `data-testid="overdue-amount"`, a `<label>`-wrapped "Date range" `<select name="preset">`, and an "Apply" submit button).

- [ ] **Step 1: Create the filter form**

Create `apps/web/src/app/dashboard/DashboardFilterForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { DATE_RANGE_PRESETS } from "@/lib/dateRange";

const PRESET_LABELS: Record<(typeof DATE_RANGE_PRESETS)[number], string> = {
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  ytd: "Year to date",
  custom: "Custom range",
};

export function DashboardFilterForm({
  preset,
  from,
  to,
}: {
  preset: (typeof DATE_RANGE_PRESETS)[number];
  from?: string;
  to?: string;
}) {
  const [selected, setSelected] = useState<(typeof DATE_RANGE_PRESETS)[number]>(preset);

  return (
    <form method="get" className="mb-6 flex flex-wrap items-end gap-2">
      <label className="block text-sm">
        Date range
        <select
          name="preset"
          value={selected}
          onChange={(e) => setSelected(e.target.value as (typeof DATE_RANGE_PRESETS)[number])}
          className="border rounded px-2 py-1 block"
        >
          {DATE_RANGE_PRESETS.map((value) => (
            <option key={value} value={value}>
              {PRESET_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      {selected === "custom" && (
        <>
          <label className="block text-sm">
            From
            <input type="date" name="from" defaultValue={from} className="border rounded px-2 py-1 block" required />
          </label>
          <label className="block text-sm">
            To
            <input type="date" name="to" defaultValue={to} className="border rounded px-2 py-1 block" required />
          </label>
        </>
      )}

      <button type="submit" className="border rounded px-3 py-1">
        Apply
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create the two Recharts widgets**

Create `apps/web/src/app/dashboard/IncomeTrendChart.tsx`:

```tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { IncomeTrendPoint } from "@/lib/dashboardMetrics";

export function IncomeTrendChart({ data }: { data: IncomeTrendPoint[] }) {
  const hasData = data.some((point) => point.totalPaid > 0);
  if (!hasData) {
    return <p className="text-gray-500">No income recorded in this range yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="totalPaid" stroke="#b45309" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

Create `apps/web/src/app/dashboard/TenantCountChart.tsx`:

```tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { TenantCountPoint } from "@/lib/dashboardMetrics";

export function TenantCountChart({ data }: { data: TenantCountPoint[] }) {
  const hasData = data.some((point) => point.activeTenantCount > 0);
  if (!hasData) {
    return <p className="text-gray-500">No active tenants in this range yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="activeTenantCount" stroke="#0f766e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Create the occupancy and overdue widgets**

Create `apps/web/src/app/dashboard/OccupancyByBuilding.tsx`:

```tsx
import type { BuildingOccupancy } from "@/lib/dashboardMetrics";

function statusFor(occupied: number, capacity: number): "vacant" | "partial" | "full" {
  if (occupied === 0) return "vacant";
  if (occupied >= capacity) return "full";
  return "partial";
}

const STATUS_CLASSES: Record<"vacant" | "partial" | "full", string> = {
  vacant: "bg-gray-100",
  partial: "bg-yellow-100",
  full: "bg-red-100",
};

export function OccupancyByBuilding({ buildings }: { buildings: BuildingOccupancy[] }) {
  if (buildings.length === 0) {
    return <p className="text-gray-500">No buildings yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {buildings.map((building) => {
        const status = statusFor(building.occupiedCapacity, building.totalCapacity);
        const pct = building.totalCapacity > 0 ? Math.round((building.occupiedCapacity / building.totalCapacity) * 100) : 0;
        return (
          <li key={building.id} data-testid="occupancy-row" className={`rounded px-3 py-2 ${STATUS_CLASSES[status]}`}>
            {building.name} — {building.occupiedCapacity}/{building.totalCapacity} ({pct}%)
          </li>
        );
      })}
    </ul>
  );
}
```

Create `apps/web/src/app/dashboard/OverdueSummary.tsx`:

```tsx
import type { OverdueSummary as OverdueSummaryData } from "@/lib/dashboardMetrics";

export function OverdueSummary({ summary }: { summary: OverdueSummaryData }) {
  return (
    <div className="flex gap-4">
      <div data-testid="overdue-count" className="rounded bg-red-100 px-4 py-3">
        <p className="text-sm text-gray-600">Overdue invoices</p>
        <p className="text-2xl font-semibold">{summary.count}</p>
      </div>
      <div data-testid="overdue-amount" className="rounded bg-red-100 px-4 py-3">
        <p className="text-sm text-gray-600">Total owed</p>
        <p className="text-2xl font-semibold">{summary.totalOwed.toFixed(2)}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace the dashboard page**

Replace the contents of `apps/web/src/app/dashboard/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { resolveDateRange, buildMonthBuckets, DATE_RANGE_PRESETS } from "@/lib/dateRange";
import { getIncomeTrend, getTenantCountTrend, getOccupancyByBuilding, getOverdueSummary } from "@/lib/dashboardMetrics";
import { DashboardFilterForm } from "./DashboardFilterForm";
import { IncomeTrendChart } from "./IncomeTrendChart";
import { TenantCountChart } from "./TenantCountChart";
import { OccupancyByBuilding } from "./OccupancyByBuilding";
import { OverdueSummary } from "./OverdueSummary";

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const { preset, from, to } = await searchParams;
  const validPreset = preset && (DATE_RANGE_PRESETS as readonly string[]).includes(preset)
    ? (preset as (typeof DATE_RANGE_PRESETS)[number])
    : "6m";
  const today = new Date();
  const range = resolveDateRange(validPreset, from, to, today);
  const buckets = buildMonthBuckets(range);

  const scoped = createScopedClient(session.user.organizationId);
  const [incomeTrend, tenantCountTrend, occupancy, overdue] = await Promise.all([
    getIncomeTrend(scoped, range, buckets),
    getTenantCountTrend(scoped, buckets),
    getOccupancyByBuilding(scoped),
    getOverdueSummary(scoped),
  ]);

  return (
    <main className="p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <DashboardFilterForm preset={validPreset} from={from} to={to} />

      <section>
        <h2 className="text-xl font-semibold mb-2">Income Trend</h2>
        <IncomeTrendChart data={incomeTrend} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Tenant Count Over Time</h2>
        <TenantCountChart data={tenantCountTrend} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Occupancy By Building</h2>
        <OccupancyByBuilding buildings={occupancy} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Overdue Payments</h2>
        <OverdueSummary summary={overdue} />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Build check**

Run: `cd apps/web && npx next build`
Expected: compiles successfully, no type errors, `/dashboard` still appears in the route manifest.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/page.tsx apps/web/src/app/dashboard/DashboardFilterForm.tsx apps/web/src/app/dashboard/IncomeTrendChart.tsx apps/web/src/app/dashboard/TenantCountChart.tsx apps/web/src/app/dashboard/OccupancyByBuilding.tsx apps/web/src/app/dashboard/OverdueSummary.tsx
git commit -m "feat(web): replace dashboard placeholder with income/occupancy/overdue widgets"
```

---

## Task 5: End-to-end coverage

**Files:**
- Create: `apps/web/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: the `/dashboard` page (Task 4) and, for one deliberate test-setup step, `prisma` directly from `@mytenants/db` (already a dependency of `apps/web`) to simulate the nightly worker's OVERDUE recalculation — there is no UI path to flip an invoice to OVERDUE within a single test run, since that transition only happens in `apps/worker`'s daily cron. This is a one-line, clearly-commented test-setup shortcut, not a new production code path.

- [ ] **Step 1: Write the e2e test**

Create `apps/web/e2e/dashboard.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { prisma } from "@mytenants/db";

test("dashboard shows income, tenant count, occupancy, and overdue widgets, and preset switching updates the URL", async ({ page }) => {
  const email = `dashboard-e2e-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByPlaceholder("Organization name").fill("Dashboard E2E Org");
  await page.getByPlaceholder("Your name").fill("E2E Owner");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Set up a building with two rooms.
  await page.goto("/dashboard/buildings");
  await page.getByLabel("Name").fill("Dashboard Hall");
  await page.getByRole("button", { name: "Add Building" }).click();
  await page.getByRole("link", { name: "Dashboard Hall" }).click();
  await page.getByLabel("Floor label").fill("1F");
  await page.getByRole("button", { name: "Add Floor" }).click();
  await page.getByLabel("Room name").fill("101");
  await page.getByLabel("Capacity").fill("1");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByRole("button", { name: "Add Room" }).click();
  await page.getByLabel("Room name").fill("102");
  await page.getByLabel("Capacity").fill("1");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByRole("button", { name: "Add Room" }).click();

  // Admit a tenant and settle their invoice in full (income widget data).
  await page.goto("/dashboard/tenants/admit");
  await page.getByLabel("First name").fill("Paid");
  await page.getByLabel("Last name").fill("Tenant");
  await page.getByLabel("Start date").fill("2026-01-01");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByLabel("Deposit amount").fill("3000");
  await page.getByRole("button", { name: "Admit Tenant" }).click();
  await expect(page).toHaveURL(/\/dashboard\/tenants\/.+/);
  await page.getByLabel("Period start").fill("2026-01-01");
  await page.getByLabel("Period end").fill("2026-01-31");
  await page.getByLabel("Due date").fill("2026-01-05");
  await page.getByLabel("Amount due").fill("3000");
  await page.getByRole("button", { name: "New Invoice" }).click();
  await page.getByTestId("invoice-row").getByRole("link").click();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/.+/);
  await page.getByLabel("Amount paid").fill("3000");
  await page.getByRole("button", { name: "Record Payment" }).click();
  await expect(page.getByTestId("invoice-status")).toHaveText("PAID");

  // Admit a second tenant with an unpaid invoice, then mark it OVERDUE directly —
  // this transition only otherwise happens via apps/worker's daily cron, which
  // this e2e run does not wait for.
  await page.goto("/dashboard/tenants/admit");
  await page.getByLabel("First name").fill("Overdue");
  await page.getByLabel("Last name").fill("Tenant");
  await page.getByLabel("Start date").fill("2026-01-01");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByLabel("Deposit amount").fill("3000");
  await page.getByRole("button", { name: "Admit Tenant" }).click();
  await expect(page).toHaveURL(/\/dashboard\/tenants\/.+/);
  await page.getByLabel("Period start").fill("2026-01-01");
  await page.getByLabel("Period end").fill("2026-01-31");
  await page.getByLabel("Due date").fill("2026-01-05");
  await page.getByLabel("Amount due").fill("3000");
  await page.getByRole("button", { name: "New Invoice" }).click();
  await page.getByTestId("invoice-row").getByRole("link").click();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/.+/);
  const invoiceId = new URL(page.url()).pathname.split("/").pop()!;
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "OVERDUE" } });

  // Dashboard reflects both tenants' occupancy, the settled income, and the overdue invoice.
  await page.goto("/dashboard");
  await expect(page.getByTestId("occupancy-row")).toContainText("2/2");
  await expect(page.getByTestId("overdue-count")).toContainText("1");
  await expect(page.getByTestId("overdue-amount")).toContainText("3000.00");

  // Switching the date-range preset updates the URL and re-renders without error.
  await page.getByLabel("Date range").selectOption("12m");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/preset=12m/);
  await expect(page.getByTestId("occupancy-row")).toContainText("2/2");
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `pnpm --filter web test:e2e`
Expected: all specs pass, including the new `dashboard.spec.ts` case, with no regressions in `auth.spec.ts`, `buildings.spec.ts`, `tenant-admission.spec.ts`, `payment-management.spec.ts`, or `notifications.spec.ts`.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test` (from the repo root)
Expected: every `apps/web`, `packages/db`, and `apps/worker` test passes, no regressions.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/dashboard.spec.ts
git commit -m "feat(web): add end-to-end coverage for the dashboard"
```

---

## Sequencing Note

This plan depends only on what's already merged (Payment Management's `Invoice`/`Payment`, Foundation's `Building`/`Floor`/`Room`/`Tenancy`). It is the last of the three "not yet built" areas named in `PRODUCT.md` — no other planned work depends on it.
