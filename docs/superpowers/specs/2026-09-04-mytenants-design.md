# MyTenants — Design Spec

Date: 2026-09-04
Status: Approved by user, pending implementation plan

## 1. Purpose

MyTenants is a multi-tenant SaaS admin dashboard for landlords/caretakers of
medium-to-large dormitories and rental buildings. Each landlord organization
manages its own building(s), tenants, room occupancy, payments, and tenant
communications through one shared, isolated-per-org application instance.

This spec covers the v1 admin-only product. A future tenant-facing UI is an
explicit non-goal for v1 but is designed for (see §8).

## 2. Architecture Overview

- **Deployment shape:** one Docker Compose stack per install (not
  microservices): `web`, `worker`, `postgres`, `caddy` (reverse proxy /
  TLS). Ships as `git pull && docker compose up -d --build`.
- **Repo layout:** small monorepo (pnpm workspaces):
  - `apps/web` — Next.js 15 (App Router) + TypeScript admin app, serves UI
    and API routes.
  - `apps/worker` — Node script(s) on a schedule (`node-cron`) for invoice
    generation and reminder emails. Runs as its own container, shares the
    same Prisma client/schema as `web`.
  - `packages/db` — Prisma schema + generated client, imported by both
    `web` and `worker` so they never drift on data model.
- **Why this shape:** a single deployable unit per landlord's VPS, no
  service-to-service network calls, no orchestration layer — matches the
  "avoid microservices, easy to deploy" constraint while still isolating
  the cron/reminder workload from the request-serving web process.

## 3. Tech Stack

| Concern | Choice | Why |
|---|---|---|
| App framework | Next.js 15 (App Router), TypeScript | One deployable for UI + API; server components suit dashboard data fetching |
| Database | PostgreSQL | Relational data (orgs, buildings, tenancies, invoices) fits relational modeling; strong Prisma support |
| ORM | Prisma | Schema-first migrations; Prisma Client Extensions give one central point to enforce org-scoping |
| Auth | Auth.js (NextAuth), credentials provider | Session-based; session carries `organizationId` |
| Charts | Recharts | Per project brief |
| Email | Resend (SMTP-compatible fallback) | Transactional email for announcements/reminders |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent, minimalist admin UI without a heavy design system |
| Background jobs | `node-cron` in `apps/worker` | Decouples reminder/invoice-generation scheduling from web process uptime |
| Reverse proxy | Caddy | Automatic HTTPS with minimal config, single VPS friendly |
| Testing | Vitest (unit/business logic), Playwright (critical-path smoke E2E) | Covers money-correctness logic and the flows most embarrassing to break |

## 4. Multi-Tenancy & Isolation

- **Isolation strategy:** shared database, `organizationId` scoping on
  every table except `Organization` itself (rejected schema-per-tenant and
  database-per-tenant as unnecessary ops overhead at this scale).
- **Enforcement:** a single Prisma Client Extension wraps all queries to
  auto-inject `where: { organizationId: session.organizationId }`. This is
  the one place that must be correct and auditable, rather than trusting
  every route handler individually.
- **Auth model (v1):** one admin `User` per `Organization` (single-admin,
  no roles/permissions system yet). `User.role` field exists in the schema
  as a forward-compatible placeholder (see §8) but only one role value is
  used in v1.

## 5. Core Data Model

Hierarchy: `Organization` → `Building` → `Floor` → `Room`, with `Tenant` and
`Tenancy` as the occupancy layer, and `Invoice`/`Payment` as the money
layer.

- **Organization** — a landlord's SaaS account. Root of all org-scoped data.
- **User** — admin login, belongs to one Organization. `role` enum
  (default/only value in v1: `OWNER`).
- **Building** — a dorm/property; an Organization can have multiple.
- **Floor** — belongs to a Building.
- **Room** — belongs to a Floor. Fields: `capacity` (integer slot count),
  `monthlyRate` (base rent, can be overridden per Tenancy).
- **Tenant** — person profile: name, contact info, emergency contact,
  `status` enum (`PROSPECT` / `ACTIVE` / `MOVED_OUT`). Documents (ID scans,
  contracts) are an explicit out-of-scope-for-v1 item; a `TenantDocument`
  table can be added later without touching this model.
- **Tenancy** — the admission/lease record: links one Tenant to one Room
  for a date range (`startDate`, nullable `endDate`), with `monthlyRate`
  and `depositAmount`, `status` enum (`ACTIVE` / `ENDED`). "Admitting a
  tenant" = creating a Tenancy. A Room's live occupancy = count of
  `ACTIVE` Tenancies against `Room.capacity`. Bed/slot-level tracking
  within a room is explicitly out of scope for v1 — occupancy is
  room-capacity-level only.
- **Invoice** — generated per billing period per Tenancy: `amountDue`,
  `dueDate`, `status` enum (`PENDING` / `PARTIAL` / `PAID` / `OVERDUE`).
- **Payment** — a recorded payment against an Invoice: `amountPaid`,
  `method` enum (`CASH` / `BANK_TRANSFER` / `GCASH` / `OTHER`, open for a
  future `GATEWAY` value), `paidAt`, `recordedByUserId`, `notes`. Multiple
  partial Payments may apply to one Invoice.
- **Notification** — an announcement or reminder: `subject`, `body`,
  `scope` enum (`ALL` / `BUILDING` / `ROOM` / `TENANT`), `trigger` enum
  (`MANUAL` / `AUTO_REMINDER`), plus a per-recipient delivery status join
  table for audit history. Manual announcements and automated reminders
  share this same table/history.

Ending a tenancy sets an `endDate`/`status: ENDED` rather than deleting
records, preserving payment and notification history.

## 6. Feature Behavior

### 6.1 Tenant CRUD & Info Management
List/search/filter tenants by status, building, room. Detail page shows
profile, current Tenancy, payment history, notification history. Editing
is in-place; there is no hard-delete of a Tenant once they have any
Tenancy/Invoice history — "end tenancy" is the terminal action instead.

### 6.2 Admitting a Tenant
Guided multi-step form:
1. Tenant info — create new, or select an existing `PROSPECT`.
2. Select Building → Floor → Room (only rooms with free capacity shown).
3. Lease terms — start date, monthly rate (prefilled from Room, editable),
   deposit amount.

Submission creates the Tenant (if new) and the Tenancy in one transaction;
building-grid occupancy reflects it immediately.

### 6.3 Payment Management
- Invoices auto-generate monthly (worker job, on each Tenancy's billing
  day) based on the Tenancy's rate.
- "Record payment" action against an Invoice supports partial payments;
  Invoice status recalculates automatically (`PENDING` → `PARTIAL` →
  `PAID`, or `OVERDUE` if past due date and unpaid/partial).
- Dashboard-level overdue view aggregates across all tenants/buildings in
  the organization.

### 6.4 Notifications
- **Manual:** admin composes an announcement, picks scope (all / one
  building / one room / one tenant), sends via Resend, logged as a
  Notification.
- **Automated:** worker checks daily for Invoices that are unpaid/partial
  and at or past their due date (with a configurable "N days before due"
  lead time), sends a reminder per affected Tenant, logged the same way as
  manual announcements.

### 6.5 Building/Dorm Overview
- Setup wizard: admin creates a Building (name + number of floors), then
  adds Rooms per Floor with capacity and base rate. Not a freeform canvas
  editor — a structured setup flow.
- Overview screen: floors stacked vertically, each floor a row of room
  cards. Each card shows occupancy (e.g. "3/4") color-coded by status
  (vacant/partial/full), clickable to see current occupants. Reuses the
  same data the admission room-picker uses.

### 6.6 Dashboard
Recharts widgets, org-scoped and date-range filterable: monthly income
trend (from Payments), tenant count over time, overdue payments
count/amount, occupancy rate across buildings.

## 7. Branding & Visual Direction

- **Name:** MyTenants (unchanged).
- **Palette:** warm clay/terracotta primary accent (distinct from generic
  SaaS blue/indigo), slate/zinc neutrals for backgrounds/text/borders, and
  semantic status colors used consistently regardless of brand accent:
  green = active/paid/occupied-ok, amber = partial/pending/near-due, red =
  overdue/full-alert, gray = vacant/inactive.
- **Icon/logo:** simple geometric building silhouette (rooflined
  rectangle, 2–3 window squares) in the clay accent color.
- **Typography/feel:** clean geometric sans (Inter or Geist), generous
  whitespace, card-based layouts, minimal borders/shadows.
- Exact token values and mockups to be produced during implementation
  (frontend-design pass), not finalized in this spec.

## 8. Explicitly Designed-In Expansion Points (not built in v1)

These are called out because the v1 schema/architecture choices above were
made specifically so these don't require rework later:

- **Tenant-facing portal:** `User.role` and org-scoped auth already exist;
  a future Tenant-linked user with a restricted role reuses the same
  auth/DB rather than a new system.
- **Payment gateway integration:** `Payment.method` is an open enum;
  adding `GATEWAY` plus a webhook handler slots in without changing the
  Invoice/Payment shape.
- **Multi-role staff (owner/caretaker):** `User.role` exists now for the
  single-admin case; adding `CARETAKER` plus permission checks is
  additive.
- **Tenant documents (ID scans, contracts):** a `TenantDocument` table can
  be added without touching the existing Tenant model.

## 9. Explicit Non-Goals for v1

- No online/gateway payment collection — manual record-keeping only.
- No multi-role staff permissions — single admin per organization.
- No bed/slot-level occupancy tracking — room-capacity-level only.
- No tenant-facing UI/portal.
- No SMS/push notifications — email only.

## 10. Deployment & Operations

- `docker-compose.yml`: `postgres` (named volume), `web`, `worker`,
  `caddy` (reverse proxy, automatic HTTPS).
- Migrations run via `prisma migrate deploy` in the `web` container's
  entrypoint before serving traffic.
- Nightly `pg_dump` cron to local disk as a baseline; shipping backups
  off-box (S3-compatible) is a recommended follow-up once real tenant data
  exists, not a v1 blocker.

## 11. Testing Strategy

- **Vitest** for business logic most worth protecting: invoice generation,
  overdue-status calculation, occupancy/capacity calculations.
- **Playwright** for a small critical-path smoke suite: login, admit a
  tenant, record a payment, send an announcement. Not full UI coverage.

## 12. Open Items for Implementation Planning

None blocking — all major decisions above were reviewed and approved. The
implementation plan should sequence work roughly as: data model + auth +
org scoping → building/room setup → tenant CRUD + admission → payments →
notifications/worker → dashboard → polish/branding pass.
