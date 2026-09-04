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
