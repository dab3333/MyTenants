# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Landlords and caretakers of medium-to-large dormitories and rental buildings. v1 has a single undifferentiated admin role per organization — the owner and a hired caretaker are treated interchangeably; nothing in the product distinguishes who is logging in, only which organization they belong to.

## Product Purpose

A multi-tenant SaaS admin dashboard: each landlord organization manages its own building(s), tenants, room occupancy, payments, and tenant communications through one shared, isolated-per-org application instance. v1 is admin-only (no tenant-facing portal).

## Positioning

Self-hosted, one-VPS-per-landlord deployment (`git pull && docker compose up -d --build`) — no SaaS lock-in, no per-unit pricing, no multi-tenant hosted infrastructure to trust. The landlord owns their data on their own infrastructure. This is the claim a hosted property-management SaaS competitor could not truthfully make.

## Operating Context

- Deployment: one Docker Compose stack per install (`web`, `worker`, `postgres`, `caddy`), not microservices.
- Isolation: shared database, `organizationId`-scoped on every table, enforced by a single Prisma Client Extension.
- Day-to-day workflows built so far: manage Buildings/Floors/Rooms and see live occupancy; admit a tenant (new or existing prospect) into a room with free capacity; end a tenancy, freeing the room and preserving history; record payments against auto-generated monthly invoices with partial-payment and overdue tracking; send manual scoped announcements and automated overdue-payment reminders; view dashboard analytics (income trend, tenant count over time, occupancy rate per building, overdue summary).
- Day-to-day workflows not yet built: none at the feature level — remaining gaps are UI-surface-only (see below).

## Capabilities and Constraints

**Confirmed v1 non-goals** (deliberate, not gaps):
- No online/gateway payment collection — manual record-keeping only.
- No multi-role staff permissions — single admin per organization.
- No bed/slot-level occupancy — room-capacity-level only.
- No tenant-facing UI/portal.
- No SMS/push notifications — email only (Resend).

**Built so far:** Building/Floor/Room CRUD with an occupancy grid; Tenant CRUD with search/status/building filters; tenant admission (new-or-existing prospect, room picker limited to free-capacity rooms, transactional creation); end-tenancy (frees the room, preserves history); Payment Management (worker-generated monthly invoices on each tenancy's billing day, manual invoice creation, partial payments, PENDING/PARTIAL/PAID/OVERDUE status recalculation); Notifications (manual announcements scoped to all/building/room/tenant, automated 7-day-cooldown overdue reminders, pluggable Resend email abstraction that safely no-ops until a real API key is configured); Dashboard (date-range-filterable income trend and tenant-count-over-time charts, capacity-based occupancy per building, overdue count/amount summary).

**Not yet built:** nothing at the feature level — all three previously-planned areas (Payment Management, Notifications, Dashboard) are complete.

**Known undecided/open gaps:** no UI yet for editing a tenant's profile fields or filtering the tenant list by building/room (the APIs already support both — only the UI surface is missing).

**Known issues (pre-existing, not yet fixed):**
- `AddRoomForm.tsx` has a race condition: its controlled form only resets state after the add-room POST resolves, so submitting a second room immediately after the first can silently lose the second room's typed values (no visible error — HTML5 required-field validation just blocks the empty resubmit). Found via e2e testing during the Dashboard plan; needs either an optimistic state reset or a submit-disable guard.
- One pre-existing `tsc --noEmit` error in `apps/web/src/app/api/invoices/__tests__/route.test.ts:34` (a test-only type mismatch, does not affect runtime behavior), from the Payment Management plan.

## Brand Commitments

- **Name:** MyTenants (unchanged).
- **Approved directional constraint** (exact tokens/mockups not yet finalized): a palette distinct from generic SaaS blue/indigo — warm clay/terracotta accent, slate/zinc neutrals — plus semantic status colors used consistently regardless of accent (green = active/paid/occupied-ok, amber = partial/pending/near-due, red = overdue/full-alert, gray = vacant/inactive). A simple geometric building-silhouette icon (roofline rectangle, 2-3 window squares) in the accent color. Clean geometric sans typography (Inter or Geist).

## Evidence on Hand

None. No real logo file, no real building/tenant data, no testimonials or case studies exist yet — this is a pre-launch internal build. Design and content work must use realistic example data and must not fabricate real-looking testimonials, logos, customer names, or press/case-study claims.

## Product Principles

- Operational correctness before polish: org-scoping, no nested writes, correct capacity/occupancy math are non-negotiable before any surface is made to look good.
- Self-hosted simplicity: every architecture and design decision should fit a single landlord on a single VPS — no microservices, no schema-per-tenant, no assumed multi-node ops.
- Occupancy and money in one view: the dashboard's core value is keeping room occupancy and payment/overdue status visibly in sync, not siloed across separate tools.
- Built for whoever is actually doing the work: owner or hired caretaker, interchangeably — v1 makes no distinction and the UI shouldn't imply one.
- Placeholder-honest: nothing shipped should look like fabricated real-world proof, since none exists yet.
