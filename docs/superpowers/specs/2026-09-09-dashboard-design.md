# Dashboard — Design Spec

Date: 2026-09-09
Status: Approved by user, pending implementation plan

Parent spec: `docs/superpowers/specs/2026-09-04-mytenants-design.md` (§6.6 Dashboard, §11 Testing Strategy)
Prior plans this reads from (no changes to either): `docs/superpowers/plans/2026-09-07-payment-management.md` (`Invoice.status`, `Payment`), `docs/superpowers/plans/2026-09-04-buildings.md` (`Building`/`Floor`/`Room`, `getBuildingOverview`).
Binding constraints: `docs/superpowers/specs/2026-09-04-foundation-constraints.md` — org-scoping (§this spec adds no new writes, so §2's no-nested-writes constraint does not apply; §3's parent-FK-validation constraint does not apply since this feature has no user-supplied parent ids) still governs every query via `createScopedClient`.

## 1. Purpose & Scope

Implements §6.6 of the parent spec: replaces the current `/dashboard` placeholder stub with an org-scoped, date-range-filterable overview of four widgets — monthly income trend, active tenant count over time, current overdue payments (count + amount), and current occupancy rate per building. This is the first place in the app where "money" and "occupancy" are shown together in one view, per the parent spec's product principle ("Occupancy and money in one view").

**In scope:** the `/dashboard` page itself, a date-range filter (fixed presets + custom range), the four widgets, and the pure computation functions behind them.

**Out of scope (explicit, decided during this spec's brainstorm):**
- No new database tables, columns, or migrations — every widget is computed on read from existing `Payment`/`Invoice`/`Tenancy`/`Room`/`Building` data. This keeps the feature consistent with "self-hosted simplicity" (no new analytics/snapshot infrastructure) and is possible because nothing here needs data that isn't already captured by prior features.
- No new API routes. The page is a server component reading the date range from URL query parameters, computing everything via Prisma directly — the same pattern already used by `/dashboard/tenants` (`?status=`, `?search=`) and `/dashboard/invoices` (`?status=`). Changing the date range submits a GET form that reloads the page with new query params; there is no client-side fetch layer.
- No caching layer. Every request recomputes from the database. Acceptable at this product's scale (one organization's data per self-hosted instance); revisit only if a real deployment shows this is slow.
- Occupancy and overdue widgets are always a current snapshot — never affected by the date-range filter. Only income trend and tenant-count trend are range-dependent. (Confirmed with user: reconsidered and rejected trending occupancy/overdue historically — adds real complexity for a "how are we doing right now" question that a snapshot already answers.)
- "Tenant count over time" means the number of tenants with an active tenancy at each point in time (a running total), not new-admissions-per-period. (Confirmed with user.)

## 2. Date-Range Resolution

Read from `/dashboard`'s `searchParams`: `preset` (`"6m" | "12m" | "ytd" | "custom"`, default `"6m"` when absent or unrecognized) and, only when `preset === "custom"`, `from`/`to` (each `YYYY-MM-DD`).

All date math is UTC-anchored (`Date.UTC(...)`), matching the convention already established by `computeInvoiceStatus` and the worker's reminder job — no per-organization timezone setting.

```ts
export type DateRange = { from: Date; to: Date };

export function resolveDateRange(
  preset: string | undefined,
  from: string | undefined,
  to: string | undefined,
  today: Date
): DateRange;
```

- `to` is always `startOfUTCDay(today)`.
- `preset === "6m"` (or `preset` absent/unrecognized): `from` = the 1st of the month that is 5 calendar months before `today`'s month (e.g. `today` = 2026-09-09 → `from` = 2026-04-01, covering Apr–Sep inclusive = 6 months).
- `preset === "12m"`: `from` = the 1st of the month 11 calendar months before `today`'s month.
- `preset === "ytd"`: `from` = January 1st of `today`'s year.
- `preset === "custom"`: `from`/`to` are parsed as UTC dates from the query params. If either is missing, fails to parse, or `from > to`, **silently fall back to the `"6m"` default** — this is a soft-fail on a GET-driven filter (like an invalid `?status=` value elsewhere in this app being silently ignored), not a validation error page.

## 3. Month Bucketing (shared by income trend & tenant-count trend)

Both range-dependent widgets are computed over the same list of monthly buckets, derived once from the resolved `{ from, to }`:

```ts
export type MonthBucket = { label: string; bucketEnd: Date }; // label e.g. "2026-05"
export function buildMonthBuckets(range: DateRange): MonthBucket[];
```

One bucket per calendar month from `from`'s month through `to`'s month, inclusive. Because `from` is always the 1st of a month (by construction in §2) and `to` is always "today" (which may fall mid-month), bucket boundaries are simple and deterministic:
- Every bucket except the last spans a full calendar month; `bucketEnd` = that month's last day.
- The last bucket's `bucketEnd` = `to` (i.e. "today") — never a future date, even if `to` falls before that month's actual last day.

## 4. Widget Specifications

All four widgets are computed by pure, independently-testable functions in a new module `apps/web/src/lib/dashboardMetrics.ts`, each taking a `scoped` client (`ReturnType<typeof createScopedClient>`) and (where relevant) the resolved `DateRange`/`MonthBucket[]`. The page calls all four in one `Promise.all`.

### 4.1 Income Trend (range-dependent)

```ts
export type IncomeTrendPoint = { label: string; totalPaid: number };
export async function getIncomeTrend(scoped, range: DateRange, buckets: MonthBucket[]): Promise<IncomeTrendPoint[]>;
```

One query: `scoped.payment.findMany({ where: { paidAt: { gte: <the resolved `from`, i.e. the first bucket's month start>, lte: to } } })`. For each bucket, sum `amountPaid` (via `Number(...)`, consistent with how this codebase already converts `Prisma.Decimal` to `number` for display, e.g. `payments/page.tsx`) across payments whose `paidAt` falls within that bucket's month and `<= bucketEnd`.

### 4.2 Tenant Count Trend (range-dependent)

```ts
export type TenantCountPoint = { label: string; activeTenantCount: number };
export async function getTenantCountTrend(scoped, buckets: MonthBucket[]): Promise<TenantCountPoint[]>;
```

One query: `scoped.tenancy.findMany({ select: { tenantId: true, startDate: true, endDate: true } })` — no date filter, since correctly answering "how many were active as of a past month-end" requires every tenancy regardless of its current `status`. For each bucket, count the number of **distinct** `tenantId`s where `startDate <= bucketEnd && (endDate === null || endDate >= bucket.bucketStart)`.

Note: the originally-specified formula above (`endDate === null || endDate > bucketEnd`) did not actually satisfy this same section's own test in practice — a tenant whose tenancy ends mid-month must still count as active for that month. The corrected formula is therefore "active for at least part of the bucket's calendar month" (`endDate >= bucket.bucketStart`) rather than "active at the exact instant of bucketEnd."

### 4.3 Occupancy By Building (current snapshot)

```ts
export type BuildingOccupancy = { id: string; name: string; occupiedCapacity: number; totalCapacity: number };
export async function getOccupancyByBuilding(scoped): Promise<BuildingOccupancy[]>;
```

Two queries (not the existing per-building `getBuildingOverview`, to avoid an N+1 across every building in the org):
1. `scoped.building.findMany({ include: { floors: { include: { rooms: true } } } }, orderBy: { name: "asc" })`.
2. `scoped.tenancy.groupBy({ by: ["roomId"], where: { status: "ACTIVE" }, _count: { _all: true } })`.

For each building, `totalCapacity` = sum of `room.capacity` across all its floors' rooms; `occupiedCapacity` = sum of the groupBy counts for those same room ids (0 if a room has no matching group). This is **capacity-based** occupancy (matching the existing Buildings overview grid's "3/4" semantics — a room's capacity can exceed 1), not a binary occupied/vacant room count.

An org with zero buildings returns `[]`; the page renders "No buildings yet" rather than a divide-by-zero.

### 4.4 Overdue Summary (current snapshot)

```ts
export type OverdueSummary = { count: number; totalOwed: number };
export async function getOverdueSummary(scoped): Promise<OverdueSummary>;
```

One query: `scoped.invoice.findMany({ where: { status: "OVERDUE" }, include: { payments: true } })`. `count` = number of such invoices. `totalOwed` = sum, across those invoices, of `Number(invoice.amountDue) - invoice.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0)` — the same remaining-balance calculation already used by `invoices/[id]/page.tsx` and `payments/page.tsx`, applied here in aggregate.

## 5. UI (`apps/web`)

- **`apps/web/src/app/dashboard/page.tsx`** (replaces the current placeholder) — server component. Reads `searchParams: Promise<{ preset?: string; from?: string; to?: string }>`, resolves the range (§2), builds buckets (§3), calls all four `dashboardMetrics.ts` functions in one `Promise.all`, and renders:
  - `DashboardFilterForm` (top) — preset selector.
  - `IncomeTrendChart` — Recharts `LineChart` over `IncomeTrendPoint[]`.
  - `TenantCountChart` — Recharts `LineChart` over `TenantCountPoint[]`.
  - `OccupancyByBuilding` — a plain styled list (not a chart): each building's name plus "`occupiedCapacity`/`totalCapacity`" and a percentage, color-coded using the same vacant/partial/full semantic-color convention as the existing Buildings occupancy grid.
  - `OverdueSummary` — two stat tiles: overdue invoice count, and total amount owed (in the red/alert semantic color per the parent spec's brand direction).
  - Any widget whose underlying dataset is empty (e.g. a fresh org with zero payments) renders a plain "No data yet" message instead of an empty/misleading chart, per the parent spec's "placeholder-honest" principle.
- **`apps/web/src/app/dashboard/DashboardFilterForm.tsx`** (new, client component) — a `<select>` for `preset` (`6m`/`12m`/`ytd`/`custom`) plus, only when `"custom"` is selected, two `<input type="date">` fields for `from`/`to` — the same conditional-field-visibility pattern already used by the Notifications feature's `NewAnnouncementForm`. Submits via a GET form to `/dashboard`, updating the URL query string (no client-side fetch).
- **Nav:** no new nav link needed — `/dashboard` is already the existing "Dashboard" landing route reached after login; this spec replaces its content, it does not add a route.

## 6. Testing Strategy

Per parent spec §11:
- **Vitest:** `dashboardMetrics.test.ts` (and a `dateRange.test.ts` for `resolveDateRange`/`buildMonthBuckets` if kept in a separate module, or the same file — implementation plan decides) covering: each preset's exact resolved boundaries, the custom-range happy path, custom-range fallback-to-default on missing/invalid/reversed dates, month-bucket generation (including the final truncated-to-today bucket), income-trend summation across bucket boundaries, tenant-count trend correctly counting a tenant whose tenancy ended mid-range (present in earlier buckets, absent from later ones) and a tenant admitted mid-range (absent from earlier buckets, present in later ones), occupancy math for a building with multiple rooms of varying capacity, occupancy for a room with zero active tenancies, an org with zero buildings, overdue summary excluding non-`OVERDUE` invoices and correctly netting out partial payments.
- **Playwright:** one new critical-path case — seed a building/room/tenant/tenancy/invoice/payment scenario (reusing the existing seeding patterns from prior e2e specs), visit `/dashboard`, assert all four widgets render with the expected computed values, then switch the preset and confirm the page reflects the new range.

## 7. Sequencing Note

Depends only on what's already merged (Payment Management's `Invoice`/`Payment`/`computeInvoiceStatus`, Foundation's `Building`/`Floor`/`Room`/`Tenancy`, Buildings' `getBuildingOverview` pattern as a reference — not reused directly, see §4.3). Nothing else in the parent spec depends on this — Dashboard is the last of the three "not yet built" areas named in `PRODUCT.md`.
