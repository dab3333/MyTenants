# Notifications — Design Spec

Date: 2026-09-08
Status: Approved by user, pending implementation plan

Parent spec: `docs/superpowers/specs/2026-09-04-mytenants-design.md` (§5 Core Data Model — `Notification`/`NotificationRecipient`; §6.4 Notifications; §11 Testing Strategy)
Prior plan: `docs/superpowers/plans/2026-09-07-payment-management.md` — this plan reads `Invoice.status = OVERDUE` (produced by that plan's worker job) and extends the same daily `apps/worker` cron with a second step.
Binding constraints: `docs/superpowers/specs/2026-09-04-foundation-constraints.md` — §2 (no nested writes) and §3 (parent-FK validation) apply to the manual-announcement route the same as every prior plan's routes.

## 1. Purpose & Scope

Implements §6.4 of the parent spec: an admin can compose a manual announcement to a scoped audience (all tenants / one building / one room / one tenant), and the worker automatically sends an overdue-payment reminder per affected tenant. Both paths write through the same `Notification`/`NotificationRecipient` audit-history tables (already scaffolded in the Foundation migration) and send email via a small, pluggable delivery abstraction.

**In scope:** a `/dashboard/announcements` composer + history UI, the manual-send API, a second worker step for automated overdue reminders, and the email-delivery abstraction (Resend-backed, safely no-op without a configured API key).

**Out of scope (explicit, decided during this spec's brainstorm):**
- No real Resend account is required to ship this. `RESEND_API_KEY` is optional; when unset, sends are logged and marked `SENT` via a no-op sender rather than actually emailing anyone. Configuring a real key later requires zero code changes.
- No per-organization configuration of reminder cadence — the "N days before due" lead time mentioned in the parent spec's §6.4 wording is replaced by a fixed v1 rule (§5 below): remind once when an invoice becomes `OVERDUE`, then again every 7 days it remains unpaid. No settings UI, no per-org config model.
- No SMS/push — email only (per parent spec's confirmed non-goals).
- No scheduled/delayed sends for manual announcements — compose-and-send-now only.
- No editing or deleting a sent notification — it's a permanent audit record, matching the "no delete, only status transitions" pattern used for `Invoice`.
- The automated reminder worker path has no UI beyond appearing in the same history list as manual announcements — no separate "reminders" page.

## 2. Data Model Changes

Two additions to the already-scaffolded `NotificationRecipient` model in `packages/db/prisma/schema.prisma` (one migration):

- **`recipientEmail String?`** — snapshots the tenant's email address at send time, so audit history stays accurate even if the tenant's `email` field is later changed or cleared. `null` when the tenant had no email on file (the skip case, §3).
- **`failureReason String?`** — set when `deliveryStatus: FAILED`, distinguishing "no email on file" from a real send-provider failure. `null` when `deliveryStatus: SENT`.

No other schema changes. `Notification` (`subject`, `body`, `scope`, `trigger`, `sentAt`) and the rest of `NotificationRecipient` (`tenantId`, `deliveryStatus`) already carry everything else both flows need. No FK from `Notification` to `Invoice` is added — the automated reminder's 7-day dedup check (§5) only needs `tenantId` + `trigger` + `sentAt`, all already present.

## 3. Email Delivery Abstraction

A single function, added to `packages/db` alongside `computeInvoiceStatus` (the existing "both `apps/web` and `apps/worker` already import this package" rationale applies identically here — no new package):

```ts
export type SendEmailInput = { to: string; subject: string; body: string };
export type SendEmailResult = { ok: true } | { ok: false; error: string };
export type SendEmail = (input: SendEmailInput) => Promise<SendEmailResult>;

export function createEmailSender(): SendEmail;
```

`createEmailSender()` reads `process.env.RESEND_API_KEY` once and returns one of two implementations:
- **Configured:** a thin wrapper around the Resend SDK's `emails.send(...)`, mapping a thrown/error response to `{ ok: false, error }`.
- **Unconfigured (no key set):** a no-op sender that `console.log`s the would-be send (`to`/`subject`) and returns `{ ok: true }` — so both flows exercise their full DB-write/audit-history logic in dev, test, and this pre-launch phase without ever touching a real inbox.

Both `apps/web`'s manual-announcement route and `apps/worker`'s reminder job call `createEmailSender()` once and pass the resulting function in — neither imports the Resend SDK directly, keeping the provider swap (if one is ever needed) to this one file.

## 4. API Surface (`apps/web`) — Manual Announcements

Follows the established constraints identically to every prior plan: `requireOrgSession()` first, `createScopedClient()`, every parent id (`buildingId`, `roomId`, `tenantId`) validated via a scoped `findFirst` before use, `findFirst`/`findMany` never `findUnique`, `Promise<{id: string}>` params, every `.create()` includes `organizationId`.

- **`POST /api/notifications`** — body: `{ scope: "ALL" | "BUILDING" | "ROOM" | "TENANT", buildingId?, roomId?, tenantId?, subject, body }`. Validates the scope-specific id field is present and belongs to the org (scoped `findFirst`), then resolves the recipient tenant list (§4.1). Email sends are network calls and must not hold a DB transaction open, so the write order is: resolve recipients → call `sendEmail` for each (or skip with a `failureReason` if the tenant has no email) → open one `scoped.$transaction` that writes the `Notification` row (`trigger: MANUAL`) plus every `NotificationRecipient` row already in its final state (`deliveryStatus`/`recipientEmail`/`failureReason` all computed from the sends that already happened) as sequential top-level scoped calls (no nested writes, per constraints §2). Returns `201` with `{ notification, recipients }` (recipient count + delivered/failed breakdown).
- **`GET /api/notifications`** — org-wide history, most-recent-first (`orderBy: { sentAt: "desc" }`). Optional `scope`/`trigger` query filters (validated against their enums, same pattern as `GET /api/invoices?status=`).
- **`GET /api/notifications/[id]`** — one notification with its full recipient list (tenant name, `recipientEmail`, `deliveryStatus`, `failureReason`) for the audit-history drill-down. Scoped `findFirst` + 404 on cross-org access, same as every other detail route.

### 4.1 Recipient Resolution Rule

- **`TENANT` scope:** the single tenant identified by `tenantId`, regardless of status (a prospect or a moved-out tenant can still be messaged directly).
- **`ALL` / `BUILDING` / `ROOM` scope:** every `Tenant` reachable through a currently `ACTIVE` `Tenancy` within that scope (`ALL` = org-wide; `BUILDING` = tenancies whose `room.floor.buildingId` matches; `ROOM` = tenancies whose `roomId` matches) — matches the worker's existing ACTIVE-only pattern for billing, since a building/room broadcast is about *current occupants*, not history.

## 5. Automated Reminder Worker Job (`apps/worker`)

A new `apps/worker/src/reminders.ts`, called from the existing daily cron in `index.ts` immediately after `runDailyBilling`, in its own `try/catch` (a reminder failure must not block billing, and vice versa — mirrors the existing error-isolation pattern in `index.ts`):

```ts
export async function runOverdueReminders(
  prisma: PrismaClient,
  sendEmail: SendEmail,
  today: Date,
): Promise<{ sent: number; skippedNoEmail: number; skippedRecentlyReminded: number }>;
```

Uses the **unscoped** `prisma` client (same rationale as `runDailyBilling` — a cross-organization batch job). Steps:

1. Query every `Invoice` with `status: "OVERDUE"`, including its `Tenancy.tenant`. Group by `tenantId` (a tenant with multiple overdue invoices gets exactly one combined reminder, per the parent spec's "a reminder per affected Tenant" wording — not one email per invoice).
2. For each Tenant with ≥1 overdue invoice: look up their most recent `AUTO_REMINDER` notification (`NotificationRecipient` joined to `Notification`, filtered by `tenantId` and `notification.trigger: "AUTO_REMINDER"`, ordered by `notification.sentAt desc`, take 1). If none exists, or its `sentAt` is ≥7 days before `today`, this tenant is due for a reminder; otherwise skip (`skippedRecentlyReminded`).
3. For a due tenant: if `tenant.email` is null, create the `Notification` + `NotificationRecipient` (`deliveryStatus: "FAILED"`, `failureReason: "No email on file"`) without calling `sendEmail`, and count `skippedNoEmail`. Otherwise, compose a body listing each overdue invoice's period/amount/due date, call `sendEmail`, and create the `Notification` (`scope: "TENANT"`, `trigger: "AUTO_REMINDER"`) + `NotificationRecipient` reflecting the real result, counting `sent`.

`index.ts` logs the returned counts the same way it already logs `runDailyBilling`'s.

## 6. UI (`apps/web`)

- **`/dashboard/announcements`** (new page, new nav link in `dashboard/layout.tsx`) — a composer form (scope selector; a conditional building/room/tenant picker depending on the selected scope, reusing the existing building/room/tenant list-fetching patterns from the Buildings and Tenant Admission UI) above a history table (subject, scope badge, trigger badge, `sentAt`, delivered/failed recipient counts). Each history row links to `/dashboard/announcements/[id]` for the full per-recipient drill-down (reusing the `GET /api/notifications/[id]` route).

## 7. Testing Strategy

Per parent spec §11:
- **Vitest:** `reminders.ts` — fixture tenancies/invoices with varying overdue states and reminder-history combinations, using an injected fake `sendEmail` test double (records calls, never a real Resend call), asserting: correct per-tenant grouping of multiple overdue invoices, the 7-day dedup window (no reminder if one was sent 3 days ago; a new one if sent 8 days ago or never), and the missing-email skip path. `POST /api/notifications` route tests following the existing org-scoping/cross-org-404 pattern, plus one test per scope's recipient-resolution rule (§4.1) and the missing-email skip.
- **Playwright:** one new critical-path case — compose an announcement (any scope), see it appear in the history table with the expected recipient/delivery-status summary.

## 8. Sequencing Note

Depends only on what's already merged (Foundation's `Notification`/`NotificationRecipient` scaffolding, Payment Management's `Invoice.status`/worker cron). Nothing else in the parent spec depends on this plan — Dashboard (§6.6) reads `Invoice`/`Payment` history directly, not `Notification` data, so it can be sequenced independently of this one.
