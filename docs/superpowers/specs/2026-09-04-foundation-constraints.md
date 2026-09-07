# Foundation Constraints for Future Plans

These are cross-cutting constraints baked into the foundation (this plan: `docs/superpowers/plans/2026-09-04-foundation.md`). Read this before building any plan on top of `apps/web`, `apps/worker`, or `packages/db`.

## 1. Middleware must stay Edge-safe

`apps/web/src/middleware.ts` imports `auth` from `@/lib/auth`, and `@/lib/auth.ts` bundles Prisma and bcrypt via its Credentials provider's `authorize()` callback. This currently works ONLY because NextAuth v5's `auth()` middleware wrapper, when invoked from the Edge-executed middleware context, decodes the session JWT directly and never calls `authorize()` — so the Prisma/bcrypt code paths are never actually reached at the Edge.

Do not assume this holds if you extend `middleware.ts` further. Any future change that adds a DB-backed check (e.g. re-verifying a user still exists, checking a revoked-session list) directly inside `middleware.ts` will break, because Prisma does not run in the Edge runtime. Before doing that:

- Split `auth.ts` into an Edge-safe `auth.config.ts` (session/callbacks only, no providers, no DB import) plus a Node-runtime `auth.ts` that adds the Credentials provider — this is NextAuth v5's own recommended pattern for this situation.
- Or, perform the DB-backed check in a Node-runtime route handler or layout instead of in `middleware.ts`. The dashboard layout's explicit `session` check (added as a second, independent guard layer in `apps/web/src/app/dashboard/layout.tsx`) is the sanctioned place for this kind of check today.

## 2. Nested relation writes through the scoped client are not scoped

`createScopedClient` (`packages/db/src/scopedClient.ts`) is a Prisma Client extension that intercepts only the top-level delegate operation being called (e.g. `tenant.create(...)`). A nested write inside that same call — for example `tenant.create({ data: { tenancies: { create: [...] } } })` — is never seen by the extension as a separate operation, so the nested `tenancies` rows are NOT stamped or filtered by `organizationId`. A forged `organizationId` supplied inside a nested create's `data` would pass through unfiltered and could write into another organization's data.

Any future plan doing a multi-model write (e.g. a tenant-admission flow creating a `Tenant` and a `Tenancy` together) must do it as sequential top-level scoped calls, not as a nested Prisma write, and must wrap those sequential calls in a Prisma `$transaction` so they commit or fail atomically. Never rely on Prisma's nested-write syntax through a scoped client.

## 3. The scoped client does not validate parent foreign keys

Scoping stamps and filters `organizationId` on the record being written or read, but it does nothing to verify that a record's OTHER foreign keys actually point to a parent belonging to the same organization — for example a `Room`'s `floorId`, or a `Tenancy`'s `roomId`. A caller-supplied FK pointing at another organization's parent row would currently be accepted by the scoped client without complaint, since the extension only inspects `organizationId`, not relation targets.

Every future route handler that accepts a user-supplied parent id (`floorId`, `roomId`, `tenancyId`, `invoiceId`, etc.) MUST explicitly verify that the referenced parent record belongs to the caller's organization — e.g. via a scoped `findFirst` lookup on the parent before using its id in a write. The scoping extension alone does not protect against a cross-organization foreign-key reference.

## 4. Nested `include` reads are not org-filtered

`apps/web/src/lib/buildingOverview.ts` does `scoped.building.findFirst({ where: { id }, include: { floors: { include: { rooms: ... } } } })`. The org-scoping extension's `$allOperations` hook only sees the top-level `building.findFirst` call — it stamps/filters `organizationId` on THAT query, but never touches the nested `floors`/`rooms` selections inside `include`. This is currently safe ONLY because of the parent-FK-validation rule above (a Floor can never have a mismatched `organizationId`/`buildingId` pair, since every write validates the parent) — it is correctness-by-invariant, not correctness-by-mechanism.

Any future plan writing a nested-`include` read (e.g. `tenancy.findMany({ include: { tenant: true } })`) must keep this in mind: the safety depends entirely on every write path maintaining the parent-FK invariant. If that invariant is ever violated, nested reads will silently leak.

## 5. Room capacity may be reduced below current occupancy

`PATCH /api/rooms/[id]` allows setting `capacity` lower than the room's current count of `ACTIVE` Tenancies (e.g. a room with 3 active tenants can have its capacity set to 1). This is a deliberate choice, not an oversight: reducing a room's capacity below its current occupancy is a legitimate landlord action (e.g. planned renovation, converting a shared room to single-occupancy going forward), not a data-integrity violation — the Tenancy rows themselves are unaffected.

The rule for any future code computing "available capacity" is: `free = max(0, capacity - occupied)` — never assume `capacity - occupied` alone is non-negative.

## 6. Capacity checks are not concurrency-safe

`POST /api/rooms/[id]/tenancies` (`apps/web/src/app/api/rooms/[id]/tenancies/route.ts`) checks free capacity by counting `ACTIVE` Tenancies for the room and comparing against `room.capacity`, then creating the new Tenancy — both inside the same `scoped.$transaction`. Postgres's default transaction isolation level is READ COMMITTED, which does not take a row lock on the count query. Two overlapping admission requests against a capacity-1 room can each run their count concurrently, each observe `activeCount < capacity`, and each commit — leaving the room with two `ACTIVE` Tenancies against a capacity of one.

The mitigation in place today is UI-level only: `AdmitTenantForm` disables its submit button while a request is in flight, which guards against a double-click on the same client but is not a database guarantee and does nothing to prevent two genuinely concurrent requests from different clients, tabs, or users.

The same read-then-write-without-locking shape exists in the end-tenancy pre-check in `apps/web/src/app/api/tenancies/[id]/end/route.ts`: it reads the tenancy, checks `status !== "ENDED"` outside the transaction, and only then updates it inside one — so two concurrent end-tenancy requests for the same tenancy could both pass the "not already ended" check before either commits.

Any future plan that needs a hard guarantee here (for example, a payments/invoicing plan that must never operate on an over-capacity room, or must never double-process ending the same tenancy) must add a real database-level guard — `SELECT ... FOR UPDATE` on the Room (or Tenancy) row inside the transaction, `Serializable` transaction isolation with retry-on-conflict, or a partial unique index — and must not assume the current check is sufficient on its own.

Related, separate limitation: a Tenant's `MOVED_OUT` status is currently terminal. The admission API only accepts an existing tenant whose `status` is `PROSPECT` (returning `TENANT_NOT_PROSPECT` otherwise), and the admission UI's "existing prospect" picker only lists `PROSPECT` tenants — so a tenant who has moved out cannot currently be re-admitted into a room without creating a duplicate Tenant record. This is a known lifecycle gap, not a decision made by this plan; a future plan should address it deliberately, e.g. by allowing `MOVED_OUT` as a valid existing-tenant status for admission and transitioning it back to `ACTIVE`.
