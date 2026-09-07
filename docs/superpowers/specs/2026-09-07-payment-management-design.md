# Payment Management — Design Spec

Date: 2026-09-07
Status: Approved by user, pending implementation plan

Parent spec: `docs/superpowers/specs/2026-09-04-mytenants-design.md` (§5 Core Data Model — `Invoice`/`Payment`; §6.3 Payment Management; §11 Testing Strategy)
Binding constraints: `docs/superpowers/specs/2026-09-04-foundation-constraints.md` — all six apply; §6 in particular ("Capacity checks are not concurrency-safe") explicitly calls out that a payments/invoicing plan needs a real database-level guard against double-processing, which this spec's Invoice uniqueness constraint (§2 below) directly answers.

## 1. Purpose & Scope

Implements §6.3 of the parent spec: monthly rent invoices generate automatically per Tenancy, an admin can also create/edit invoices manually, payments record against invoices (supporting partials), and invoice status tracks automatically through `PENDING` → `PARTIAL` → `PAID`, or `OVERDUE` when past due and unpaid/partial. Adds the first org-wide aggregate view (`/dashboard/payments`) and the first scheduled worker job in `apps/worker`.

**In scope:** invoice auto-generation (worker, daily cron), manual invoice create/edit, payment recording, invoice status lifecycle, an org-wide overdue/payments view, a per-tenancy invoice history on the tenant detail page.

**Out of scope (explicit, matches parent spec §9's non-goals plus decisions made during this spec's brainstorm):**
- No online/gateway payment collection — manual record-keeping only (`Payment.method` stays `CASH`/`BANK_TRANSFER`/`GCASH`/`OTHER`).
- No invoice deletion or void action — an admin who wants to cancel an invoice edits `amountDue` to `0`.
- No proration of a tenant's first invoice — invoicing starts at the tenant's next full billing cycle after admission; the partial first period is handled outside the invoice system (e.g. via the deposit or a manual arrangement).
- `Tenancy.depositAmount` is never invoiced or turned into a `Payment` record — it stays a stored, informational fact only.
- No overpayment — recording a payment that would exceed an invoice's remaining balance is rejected.
- No Notifications (§6.4) or Dashboard/Recharts (§6.6) work — this plan only produces the `Invoice.status` data those future plans will read (`OVERDUE` for automated reminders; invoice/payment history for income-trend charts).
- No editing `Tenancy.billingDay` after admission — if it needs to change, end the tenancy and re-admit (matches the existing pattern that `Tenancy` has no `PATCH` endpoint today).

## 2. Data Model Changes

Two additions to `packages/db/prisma/schema.prisma`, each its own migration:

- **`Tenancy.billingDay Int`** — the day-of-month rent is billed on for this tenancy. Set once at admission time (pre-filled in the admission form from `startDate`'s day-of-month, editable before submit), never editable afterward. Valid range 1-31, validated at the API layer (not a DB constraint, since Prisma has no native range check) — invoice generation clamps to month-end when a month is shorter than `billingDay` (e.g. `billingDay: 31` bills on April 30 in April).
- **`@@unique([tenancyId, periodStart])` on `Invoice`** — a real database-level guard against generating two invoices for the same tenancy covering the same period, whether from a worker retry, a restart, or (per constraints doc §6) genuinely concurrent execution. The worker's generation step must handle this constraint's violation as an expected, silent skip (not an error), since "someone else already created this period's invoice" is a successful outcome, not a failure.

No other schema changes — `Invoice` and `Payment` already carry every other field this spec needs (`amountDue`, `dueDate`, `status`; `amountPaid`, `method`, `paidAt`, `recordedByUserId`, `notes`).

## 3. Shared Logic: `packages/db/src/invoiceStatus.ts`

A pure function with no DB access, exported from `packages/db`'s index alongside the Prisma client, since it is the one package both `apps/web` and `apps/worker` already import and the spec's own charter for that package is "imported by both web and worker so they never drift":

```ts
import type { Decimal } from "@prisma/client/runtime/library";

export type InvoiceStatusInput = {
  amountDue: Decimal;
  totalPaid: Decimal;
  dueDate: Date;
  today: Date;
};

export function computeInvoiceStatus(input: InvoiceStatusInput): "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
```

Rules, in priority order:
1. `totalPaid >= amountDue` → `PAID` (covers exact payment and the edit-invoice-down-after-payment case from §5 below; there is no distinct "overpaid" status).
2. `totalPaid > 0` and `today > dueDate` → `OVERDUE` (a partially-paid invoice past due is still overdue, not merely partial).
3. `today > dueDate` → `OVERDUE`.
4. `totalPaid > 0` → `PARTIAL`.
5. Otherwise → `PENDING`.

Every caller (the worker's daily recalculation step, the record-payment route, the manual-edit route) computes `totalPaid` as the DB-side sum of that invoice's `Payment.amountPaid` rows, using Prisma's `Decimal` arithmetic — never a plain JS-float sum — and passes it in rather than letting this function touch the database itself, keeping it trivially unit-testable (a table of amountDue/totalPaid/dueDate/today → expected status, covering every branch above).

## 4. Worker Job (`apps/worker`)

One daily `node-cron` schedule in `apps/worker/src/index.ts`, calling a plain exported function in a new `apps/worker/src/billing.ts`:

```ts
export async function runDailyBilling(prisma: PrismaClient, today: Date): Promise<{ generated: number; recalculated: number }>;
```

Takes the **unscoped** `prisma` client (imported directly from `@mytenants/db`, not `createScopedClient`) — deliberately: this is the first cross-organization batch job in the codebase, and every prior plan's org-scoping pattern assumes a single-org request context that does not apply to a job that must process every organization in one run. This is called out explicitly here because it is the one place that intentionally does not follow the "always use the scoped client" rule every other route in the codebase follows.

Takes `today` as a parameter (not reading `new Date()` internally) specifically so Vitest can drive it with a fixed date without mocking the system clock.

Each run does two things, in order:

1. **Generate.** For every `Tenancy` with `status: ACTIVE` whose month-end-clamped `billingDay` equals `today`'s day-of-month, attempt to create an `Invoice`: `amountDue = tenancy.monthlyRate`, `periodStart = today`, `periodEnd` = the day before next month's (clamped) billing date, `dueDate = periodStart`, `status = PENDING`. Rely on the `@@unique([tenancyId, periodStart])` constraint to make a duplicate attempt a no-op (catch the unique-violation, count it as skipped, do not treat it as an error).
2. **Recalculate overdue.** For every `Invoice` with `status` in `PENDING`/`PARTIAL`, recompute via `computeInvoiceStatus` against `today` and persist the result if it changed (this is what actually flips something to `OVERDUE`; nothing else in the system does).

`apps/worker/src/index.ts` wires the cron schedule (once daily, exact time not product-significant — pick a low-traffic hour) to call `runDailyBilling(prisma, new Date())` and log the counts returned.

**Timezone assumption:** "today" and every `billingDay`/`dueDate` comparison use the deploy container's local clock/date, with no per-organization timezone setting — a reasonable v1 simplification for a self-hosted, one-VPS-per-landlord product where the landlord's own server is already in (or close enough to) their own timezone. Not revisited unless a future plan needs multi-region support.

## 5. API Surface (`apps/web`)

All routes follow the established constraints: `requireOrgSession()` first, `createScopedClient`, every parent id (`tenancyId`, `invoiceId`) validated via a scoped `findFirst` before use, `findFirst`/`findMany` never `findUnique`, `Promise<{id: string}>` params.

- **`POST /api/tenancies/[id]/invoices`** — manual invoice creation. Body: `{ periodStart, periodEnd, amountDue, dueDate }`. Validates the tenancy belongs to the caller's org. `status` always starts `PENDING` regardless of body content (same "status is never client-settable" pattern as `Tenant`). Shares the same `@@unique([tenancyId, periodStart])` constraint as the worker's auto-generation — a manual invoice for a period that already has one (auto-generated or manual) hits that constraint too; catch it and return a clean 409 ("an invoice already exists for this tenancy covering this period") rather than letting a raw DB constraint violation surface as a 500.
- **`GET /api/invoices`** — org-wide list. Query params: `status` (validated against the enum), `tenancyId` (validated ownership if present). Backs both the `/dashboard/payments` view and the tenant detail page's per-tenancy invoice history (`?tenancyId=...`).
- **`PATCH /api/invoices/[id]`** — edit `amountDue`, `dueDate`, `periodStart`, `periodEnd` on an existing invoice. After writing, recomputes and persists `status` via `computeInvoiceStatus` (so editing `amountDue` down below what's already been paid resolves cleanly to `PAID`). No delete/void endpoint (see §1 non-goals).
- **`POST /api/invoices/[id]/payments`** — record a payment. Body: `{ amountPaid, method, paidAt?, notes? }`. Validates the invoice belongs to the org, computes the invoice's current `totalPaid` (sum of existing `Payment.amountPaid`), rejects with 409 if `amountPaid` would push `totalPaid` past `amountDue`, otherwise creates the `Payment` (stamping `recordedByUserId` from the session) and recomputes/persists the invoice's `status`.

**Money at the boundary:** amounts still cross as JS numbers in request/response bodies, matching the established pattern from the Tenant Admission plan (validated with `Number.isFinite(x) && x >= 0`, learned from that plan's final review). What's new here is that every *balance computation* — `totalPaid`, the overpayment check, every status recalculation — happens server-side using Prisma's `Decimal` type end-to-end, never plain float arithmetic, because this is the first plan where money gets summed across multiple rows and compared repeatedly rather than only stored and displayed.

## 6. UI (`apps/web`)

- **`/dashboard/payments`** (new page, new nav link in `dashboard/layout.tsx`) — org-wide table: tenant name, room, period, `amountDue`, paid-so-far, status badge, due date. Filterable by status (`OVERDUE` the default/most prominent filter). Each row links to the invoice detail page.
- **`/dashboard/invoices/[id]`** (new page) — invoice detail: all fields, full payment history table, a record-payment form, an edit-invoice form.
- **Tenant detail page** (`dashboard/tenants/[id]/page.tsx`, existing — extended) — a new "Invoices" section per Tenancy (fetches `GET /api/invoices?tenancyId=...`), with a "New Invoice" entry point opening the manual-creation form for that tenancy.
- **Admission wizard** (`AdmitTenantForm.tsx`, existing — extended) — one new field, `billingDay`, pre-filled from the chosen `startDate`'s day-of-month, editable before submit.

## 7. Testing Strategy

Per parent spec §11:
- **Vitest:** `computeInvoiceStatus` — an exhaustive table test over the priority rules in §3. `runDailyBilling` — fixture tenancies with varying `billingDay`/status/existing-invoice combinations, asserting exactly the right invoices are created and exactly the right statuses flip, and that running it twice for the same `today` is a no-op (proving the unique constraint actually holds). API route tests for all four new/changed routes following the existing org-scoping/cross-org-404 test pattern established in every prior plan, plus the overpayment-rejection and status-recalculation-after-edit cases specifically.
- **Playwright:** one new critical-path case per parent spec §11 — admit a tenant, wait for (or directly seed) an invoice, record a payment, see the status update.

## 8. Sequencing Note

This plan depends on nothing beyond what's already merged (Foundation, Buildings, Tenant Admission). It is itself a dependency for two future plans: Notifications (§6.4's automated reminder job reads `Invoice.status = OVERDUE`) and Dashboard (§6.6's income-trend/overdue widgets read `Invoice`/`Payment` history) — both should be scoped after this one, per the parent spec's §12 suggested sequencing.
