# Tenant Admission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a landlord admit a tenant (new or an existing prospect) into a room with free capacity, track tenants and their lease history, and end a tenancy when someone moves out — all while keeping the building occupancy grid (from the Buildings plan) live and accurate.

**Architecture:** All new work lives in `apps/web` (the `Tenant`/`Tenancy` schema already exists from the Foundation plan, unused by any UI until now). Every route follows the established patterns from the Foundation and Buildings plans: `requireOrgSession()` first, a scoped Prisma client for all DB access, `findFirst` never `findUnique`, and a parent id (a `roomId` when admitting, a `tenancyId` when ending one) validated via a scoped lookup before use. The one new pattern this plan introduces: admitting a tenant and ending a tenancy each write to *two* models (Tenant + Tenancy) — per `docs/superpowers/specs/2026-09-04-foundation-constraints.md`'s nested-writes rule, these are done as sequential top-level calls inside `scoped.$transaction(async (tx) => {...})`, never a nested Prisma write. This is the officially-supported way to get atomic multi-model writes through a Prisma Client Extension, and Task 1 of this plan verifies empirically that org-scoping actually holds inside the transaction before anything else in this plan relies on it.

**Tech Stack:** Next.js 15 (App Router), Prisma (existing schema), Vitest, Playwright — same stack as the prior two plans.

**Spec:** `docs/superpowers/specs/2026-09-04-mytenants-design.md` (see §5 Core Data Model, §6.1 Tenant CRUD & Info Management, §6.2 Admitting a Tenant)
**Constraints:** `docs/superpowers/specs/2026-09-04-foundation-constraints.md` — binding on every task in this plan, especially the nested-writes and parent-FK-validation rules.

## Global Constraints

- Every route accepting a user-supplied parent id (a `roomId` when creating a Tenancy, a `tenancyId` when ending one) MUST verify that parent belongs to the caller's organization via a scoped `findFirst`/transaction-scoped lookup before using it — 404 (not 403) on mismatch, without revealing whether the id exists in another org.
- No nested Prisma writes across Tenant/Tenancy. Admitting a tenant and ending a tenancy each do two sequential top-level writes inside `scoped.$transaction(async (tx) => {...})`.
- Org-scoped models are queried via `findFirst`/`findMany`, never `findUnique`.
- No API route may skip `requireOrgSession()` as its first line.
- `PATCH /api/tenants/[id]` updates profile fields only (`firstName`/`lastName`/`email`/`phone`/`emergencyContact`) — it never changes `status`. Status transitions (`PROSPECT`→`ACTIVE` on admission, `ACTIVE`→`MOVED_OUT` on ending a tenancy) only happen through the admission and end-tenancy endpoints, so the state machine has exactly two entry points instead of being editable from anywhere.
- No bed/slot-level occupancy — a room's free capacity is `max(0, capacity - occupied)`, where `occupied` is the count of `ACTIVE` Tenancies for that room, per the constraints doc.
- Ending a tenancy never deletes rows — it sets `endDate`/`status: ENDED` on the Tenancy and `status: MOVED_OUT` on the Tenant, preserving history, per spec §6.1.
- Every `.create()` call on an org-scoped model includes `organizationId: session.organizationId` in its data literal (inert at runtime — the scoping extension always overwrites it — but required to satisfy Prisma's generated create-input type under strict TypeScript, per the Buildings plan's Task 1 finding).
- Route/page dynamic-segment `params` are `Promise<{ id: string }>`, resolved via `await params` (Next.js 15).
- Every form `<input>` is wrapped inside its `<label>` (not a sibling pair) so `page.getByLabel(...)` resolves it in E2E tests.

---

## Task 1: Tenant CRUD API

**Files:**
- Create: `apps/web/src/app/api/tenants/route.ts`
- Test: `apps/web/src/app/api/tenants/__tests__/route.test.ts`
- Create: `apps/web/src/app/api/tenants/[id]/route.ts`
- Test: `apps/web/src/app/api/tenants/[id]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `requireOrgSession` from `@/lib/requireOrgSession`, `createScopedClient`/`Prisma` from `@mytenants/db` (all from the Foundation/Buildings plans).
- Produces: `GET`/`POST /api/tenants`, `GET`/`PATCH /api/tenants/[id]` — Task 5's UI reads/writes through these. Establishes the `Tenant` JSON shape (`{ id, organizationId, firstName, lastName, email, phone, emergencyContact, status, createdAt, tenancies: [...] }`) later tasks' UI destructures.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/app/api/tenants/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { GET, POST } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

describe("GET/POST /api/tenants", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/tenants"));
    expect(res.status).toBe(401);
  });

  it("creates a prospect tenant and only lists it for the same organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Tenants" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Tenants" } });

    sessionFor(orgA.id);
    const createRes = await POST(
      new Request("http://localhost/api/tenants", {
        method: "POST",
        body: JSON.stringify({ firstName: "Jane", lastName: "Doe", email: "jane@example.com" }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.tenant.status).toBe("PROSPECT");
    expect(created.tenant.organizationId).toBe(orgA.id);

    const listResA = await GET(new Request("http://localhost/api/tenants"));
    const listedA = await listResA.json();
    expect(listedA.tenants).toHaveLength(1);
    expect(listedA.tenants[0].firstName).toBe("Jane");

    sessionFor(orgB.id);
    const listResB = await GET(new Request("http://localhost/api/tenants"));
    const listedB = await listResB.json();
    expect(listedB.tenants).toHaveLength(0);
  });

  it("returns 400 when firstName or lastName is missing", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Missing Name" } });
    sessionFor(org.id);

    const res = await POST(
      new Request("http://localhost/api/tenants", { method: "POST", body: JSON.stringify({ lastName: "Doe" }) })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("firstName is required");
  });

  it("filters by status", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Status Filter" } });
    await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "One", status: "PROSPECT" } });
    await prisma.tenant.create({ data: { organizationId: org.id, firstName: "B", lastName: "Two", status: "ACTIVE" } });

    sessionFor(org.id);
    const res = await GET(new Request("http://localhost/api/tenants?status=ACTIVE"));
    const data = await res.json();
    expect(data.tenants).toHaveLength(1);
    expect(data.tenants[0].firstName).toBe("B");
  });

  it("rejects an invalid status filter with 400", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Invalid Status" } });
    sessionFor(org.id);

    const res = await GET(new Request("http://localhost/api/tenants?status=NOT_A_STATUS"));
    expect(res.status).toBe(400);
  });

  it("filters by search term matching first or last name (case-insensitive)", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Search Filter" } });
    await prisma.tenant.create({ data: { organizationId: org.id, firstName: "Alice", lastName: "Smith", status: "PROSPECT" } });
    await prisma.tenant.create({ data: { organizationId: org.id, firstName: "Bob", lastName: "Jones", status: "PROSPECT" } });

    sessionFor(org.id);
    const res = await GET(new Request("http://localhost/api/tenants?search=ali"));
    const data = await res.json();
    expect(data.tenants).toHaveLength(1);
    expect(data.tenants[0].firstName).toBe("Alice");
  });

  it("filters by buildingId, matching only tenants with an active tenancy in that building", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Building Filter" } });
    const buildingA = await prisma.building.create({ data: { organizationId: org.id, name: "A Hall" } });
    const buildingB = await prisma.building.create({ data: { organizationId: org.id, name: "B Hall" } });
    const floorA = await prisma.floor.create({ data: { organizationId: org.id, buildingId: buildingA.id, label: "1F" } });
    const floorB = await prisma.floor.create({ data: { organizationId: org.id, buildingId: buildingB.id, label: "1F" } });
    const roomA = await prisma.room.create({ data: { organizationId: org.id, floorId: floorA.id, name: "101", capacity: 2, monthlyRate: "3000.00" } });
    const roomB = await prisma.room.create({ data: { organizationId: org.id, floorId: floorB.id, name: "101", capacity: 2, monthlyRate: "3000.00" } });
    const tenantA = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "In", lastName: "BuildingA", status: "ACTIVE" } });
    const tenantB = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "In", lastName: "BuildingB", status: "ACTIVE" } });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenantA.id, roomId: roomA.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenantB.id, roomId: roomB.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });

    sessionFor(org.id);
    const res = await GET(new Request(`http://localhost/api/tenants?buildingId=${buildingA.id}`));
    const data = await res.json();
    expect(data.tenants).toHaveLength(1);
    expect(data.tenants[0].lastName).toBe("BuildingA");
  });
});
```

`apps/web/src/app/api/tenants/[id]/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { GET, PATCH } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

describe("GET/PATCH /api/tenants/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 404 for a tenant belonging to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Tenant Detail" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Tenant Detail" } });
    const tenantB = await prisma.tenant.create({ data: { organizationId: orgB.id, firstName: "B", lastName: "Tenant", status: "PROSPECT" } });

    sessionFor(orgA.id);
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: tenantB.id }) });
    expect(res.status).toBe(404);
  });

  it("updates a tenant's profile fields for its own organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Tenant Update" } });
    const tenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "Old", lastName: "Name", status: "PROSPECT" } });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ firstName: "New", phone: "555-1234" }) }),
      { params: Promise.resolve({ id: tenant.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tenant.firstName).toBe("New");
    expect(data.tenant.phone).toBe("555-1234");
  });

  it("ignores an attempt to change status via PATCH", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Tenant Status Guard" } });
    const tenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "B", status: "PROSPECT" } });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "ACTIVE" }) }),
      { params: Promise.resolve({ id: tenant.id }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tenant.status).toBe("PROSPECT");
  });

  it("returns 404 when updating another organization's tenant", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Tenant Update Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Tenant Update Guard" } });
    const tenantB = await prisma.tenant.create({ data: { organizationId: orgB.id, firstName: "B", lastName: "Tenant", status: "PROSPECT" } });

    sessionFor(orgA.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ firstName: "Hijacked" }) }),
      { params: Promise.resolve({ id: tenantB.id }) }
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test -- tenants`
Expected: FAIL with `Cannot find module '../route'`.

- [ ] **Step 3: Implement the Tenant CRUD routes**

`apps/web/src/app/api/tenants/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createScopedClient, Prisma } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

const TENANT_STATUSES = ["PROSPECT", "ACTIVE", "MOVED_OUT"] as const;
type TenantStatus = (typeof TENANT_STATUSES)[number];

export async function GET(request: Request) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const buildingId = searchParams.get("buildingId");
  const search = searchParams.get("search");

  if (statusParam && !TENANT_STATUSES.includes(statusParam as TenantStatus)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const where: Prisma.TenantWhereInput = {
    ...(statusParam ? { status: statusParam as TenantStatus } : {}),
    ...(buildingId
      ? { tenancies: { some: { status: "ACTIVE", room: { floor: { buildingId } } } } }
      : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const scoped = createScopedClient(session.organizationId);
  const tenants = await scoped.tenant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      tenancies: {
        where: { status: "ACTIVE" },
        include: { room: { include: { floor: { include: { building: true } } } } },
      },
    },
  });

  return NextResponse.json({ tenants });
}

export async function POST(request: Request) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.firstName !== "string" || body.firstName.trim() === "") {
    return NextResponse.json({ error: "firstName is required" }, { status: 400 });
  }
  if (typeof body.lastName !== "string" || body.lastName.trim() === "") {
    return NextResponse.json({ error: "lastName is required" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const tenant = await scoped.tenant.create({
    data: {
      organizationId: session.organizationId,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: typeof body.email === "string" && body.email.trim() !== "" ? body.email.trim() : null,
      phone: typeof body.phone === "string" && body.phone.trim() !== "" ? body.phone.trim() : null,
      emergencyContact:
        typeof body.emergencyContact === "string" && body.emergencyContact.trim() !== ""
          ? body.emergencyContact.trim()
          : null,
      status: "PROSPECT",
    },
  });
  return NextResponse.json({ tenant }, { status: 201 });
}
```

`apps/web/src/app/api/tenants/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createScopedClient, type Prisma } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;
  const { id } = await params;

  const scoped = createScopedClient(session.organizationId);
  const tenant = await scoped.tenant.findFirst({
    where: { id },
    include: {
      tenancies: {
        orderBy: { startDate: "desc" },
        include: { room: { include: { floor: { include: { building: true } } } } },
      },
    },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  return NextResponse.json({ tenant });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const existing = await scoped.tenant.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const data: Prisma.TenantUpdateInput = {};
  if (typeof body.firstName === "string" && body.firstName.trim() !== "") data.firstName = body.firstName.trim();
  if (typeof body.lastName === "string" && body.lastName.trim() !== "") data.lastName = body.lastName.trim();
  if (typeof body.email === "string") data.email = body.email.trim() === "" ? null : body.email.trim();
  if (typeof body.phone === "string") data.phone = body.phone.trim() === "" ? null : body.phone.trim();
  if (typeof body.emergencyContact === "string") {
    data.emergencyContact = body.emergencyContact.trim() === "" ? null : body.emergencyContact.trim();
  }
  // `status` is intentionally never read from the body — see Global Constraints.

  const tenant = await scoped.tenant.update({ where: { id }, data });
  return NextResponse.json({ tenant });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test`
Expected: PASS (all tests, including all pre-existing tests from the Foundation/Buildings plans).

- [ ] **Step 5: Run `next build` to confirm no type errors**

Run: `cd apps/web && npx next build` (from repo root)
Expected: succeeds. If `Prisma.TenantWhereInput`/`Prisma.TenantUpdateInput` aren't exported the way this code assumes, adjust the import/type reference as needed to make it typecheck — the runtime behavior is what matters, the exact type import path is negotiable.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/tenants
git commit -m "feat(web): add Tenant CRUD API with status/search/building filters"
```

---

## Task 2: Available-Rooms Query

**Files:**
- Create: `apps/web/src/lib/availableRooms.ts`
- Test: `apps/web/src/lib/__tests__/availableRooms.test.ts`

**Interfaces:**
- Consumes: `createScopedClient` from `@mytenants/db` (Foundation plan); reads `Building`/`Floor`/`Room`/`Tenancy` (Buildings plan's schema).
- Produces: `getAvailableRooms(scoped: ReturnType<typeof createScopedClient>): Promise<AvailableRoom[]>` and the exported `AvailableRoom` type (`{ roomId, roomName, floorLabel, buildingId, buildingName, capacity, occupied, monthlyRate }`) — Task 6's admission page reads this directly.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/__tests__/availableRooms.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { prisma, createScopedClient } from "@mytenants/db";
import { getAvailableRooms } from "../availableRooms";

describe("getAvailableRooms", () => {
  it("returns only rooms with free capacity, across multiple buildings, org-scoped", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Available Rooms" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Available Rooms" } });

    const buildingA1 = await prisma.building.create({ data: { organizationId: orgA.id, name: "A Hall" } });
    const buildingA2 = await prisma.building.create({ data: { organizationId: orgA.id, name: "A Annex" } });
    const floorA1 = await prisma.floor.create({ data: { organizationId: orgA.id, buildingId: buildingA1.id, label: "1F" } });
    const floorA2 = await prisma.floor.create({ data: { organizationId: orgA.id, buildingId: buildingA2.id, label: "1F" } });

    const fullRoom = await prisma.room.create({
      data: { organizationId: orgA.id, floorId: floorA1.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
    });
    const vacantRoom = await prisma.room.create({
      data: { organizationId: orgA.id, floorId: floorA2.id, name: "201", capacity: 2, monthlyRate: "3500.00" },
    });
    const tenant = await prisma.tenant.create({ data: { organizationId: orgA.id, firstName: "A", lastName: "One", status: "ACTIVE" } });
    await prisma.tenancy.create({
      data: { organizationId: orgA.id, tenantId: tenant.id, roomId: fullRoom.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });

    // Another org's rooms must never appear.
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });
    const floorB = await prisma.floor.create({ data: { organizationId: orgB.id, buildingId: buildingB.id, label: "1F" } });
    await prisma.room.create({ data: { organizationId: orgB.id, floorId: floorB.id, name: "999", capacity: 5, monthlyRate: "1.00" } });

    const scoped = createScopedClient(orgA.id);
    const available = await getAvailableRooms(scoped);

    expect(available).toHaveLength(1);
    expect(available[0].roomId).toBe(vacantRoom.id);
    expect(available[0].buildingName).toBe("A Annex");
    expect(available[0].floorLabel).toBe("1F");
    expect(available[0].capacity).toBe(2);
    expect(available[0].occupied).toBe(0);
  });

  it("excludes a room whose capacity was reduced below its current occupancy (free = max(0, capacity - occupied))", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Reduced Capacity" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
    });
    const tenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "One", status: "ACTIVE" } });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant.id, roomId: room.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });
    // Reduce capacity below the current 1 active tenancy.
    await prisma.room.update({ where: { id: room.id }, data: { capacity: 0 } });

    const scoped = createScopedClient(org.id);
    const available = await getAvailableRooms(scoped);

    expect(available).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web test -- availableRooms`
Expected: FAIL with `Cannot find module '../availableRooms'`.

- [ ] **Step 3: Implement `getAvailableRooms`**

`apps/web/src/lib/availableRooms.ts`:
```ts
import type { createScopedClient } from "@mytenants/db";

export type AvailableRoom = {
  roomId: string;
  roomName: string;
  floorLabel: string;
  buildingId: string;
  buildingName: string;
  capacity: number;
  occupied: number;
  monthlyRate: string;
};

export async function getAvailableRooms(
  scoped: ReturnType<typeof createScopedClient>
): Promise<AvailableRoom[]> {
  const rooms = await scoped.room.findMany({
    include: { floor: { include: { building: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (rooms.length === 0) return [];

  const occupancyCounts = await scoped.tenancy.groupBy({
    by: ["roomId"],
    where: { roomId: { in: rooms.map((room) => room.id) }, status: "ACTIVE" },
    _count: { _all: true },
  });
  const occupiedByRoomId = new Map(occupancyCounts.map((row) => [row.roomId, row._count._all]));

  return rooms
    .map((room) => ({
      roomId: room.id,
      roomName: room.name,
      floorLabel: room.floor.label,
      buildingId: room.floor.building.id,
      buildingName: room.floor.building.name,
      capacity: room.capacity,
      occupied: occupiedByRoomId.get(room.id) ?? 0,
      monthlyRate: room.monthlyRate.toString(),
    }))
    .filter((room) => Math.max(0, room.capacity - room.occupied) > 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web test -- availableRooms`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/availableRooms.ts apps/web/src/lib/__tests__/availableRooms.test.ts
git commit -m "feat(web): add cross-building available-rooms query for tenant admission"
```

---

## Task 3: Admission API (the critical task — verifies `$transaction` + scoping composability)

**Files:**
- Create: `apps/web/src/app/api/rooms/[id]/tenancies/route.ts`
- Test: `apps/web/src/app/api/rooms/[id]/tenancies/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `requireOrgSession`, `createScopedClient` (Foundation plan). Writes to `Tenant` and `Tenancy` inside one `scoped.$transaction`.
- Produces: `POST /api/rooms/[id]/tenancies` — Task 6's admission form posts here. Response shape `{ tenant, tenancy }`.

**Before writing the route, verify the core assumption this whole plan depends on:** does `scoped.$transaction(async (tx) => { ... })` (where `scoped` comes from `createScopedClient`) actually apply org-scoping to calls made on `tx` inside the callback? Prisma Client Extensions are documented to compose with interactive transactions this way, but it has never been exercised in this codebase before now. The test below (`"stamps organizationId on writes made inside the transaction, even inside a rolled-back attempt"`) exists specifically to prove this. If it does NOT hold — if `tx` inside the callback turns out to be an unscoped client — STOP and report BLOCKED immediately; do not implement a workaround on your own, since the fix would affect the constraints doc's prescribed pattern for every future plan.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/app/api/rooms/[id]/tenancies/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma, createScopedClient } from "@mytenants/db";
import { POST } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

async function makeRoom(organizationId: string, capacity = 1) {
  const building = await prisma.building.create({ data: { organizationId, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId, buildingId: building.id, label: "1F" } });
  return prisma.room.create({
    data: { organizationId, floorId: floor.id, name: "101", capacity, monthlyRate: "3000.00" },
  });
}

describe("scoped.$transaction composability (foundational check)", () => {
  it("stamps organizationId on writes made inside the transaction, and rejects cross-org reads inside it", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Tx Check" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Tx Check" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });

    const scopedA = createScopedClient(orgA.id);

    const created = await scopedA.$transaction(async (tx) => {
      return tx.tenant.create({
        data: { organizationId: orgB.id, firstName: "Forged", lastName: "Org", status: "PROSPECT" },
      });
    });
    expect(created.organizationId).toBe(orgA.id);

    const foundInTx = await scopedA.$transaction(async (tx) => {
      return tx.building.findFirst({ where: { id: buildingB.id } });
    });
    expect(foundInTx).toBeNull();
  });
});

describe("POST /api/rooms/[id]/tenancies", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("admits a new tenant into a room, creating both Tenant and Tenancy", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Admit New" } });
    const room = await makeRoom(org.id, 2);

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          tenant: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
          startDate: "2026-01-01",
          monthlyRate: 3000,
          depositAmount: 3000,
        }),
      }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.tenant.status).toBe("ACTIVE");
    expect(data.tenancy.roomId).toBe(room.id);
    expect(data.tenancy.status).toBe("ACTIVE");

    const activeCount = await prisma.tenancy.count({ where: { roomId: room.id, status: "ACTIVE" } });
    expect(activeCount).toBe(1);
  });

  it("admits an existing PROSPECT tenant, transitioning their status to ACTIVE", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Admit Prospect" } });
    const room = await makeRoom(org.id, 1);
    const prospect = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "P", lastName: "Rospect", status: "PROSPECT" } });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ tenant: { id: prospect.id }, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }),
      }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.tenant.id).toBe(prospect.id);
    expect(data.tenant.status).toBe("ACTIVE");
  });

  it("returns 409 and creates nothing when the room has no free capacity", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Admit Full" } });
    const room = await makeRoom(org.id, 1);
    const existingTenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "X", lastName: "Y", status: "ACTIVE" } });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: existingTenant.id, roomId: room.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ tenant: { firstName: "New", lastName: "Comer" }, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }),
      }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(409);
    const tenantCount = await prisma.tenant.count({ where: { organizationId: org.id, firstName: "New" } });
    expect(tenantCount).toBe(0);
  });

  it("returns 404 when the room belongs to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Admit Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Admit Guard" } });
    const roomB = await makeRoom(orgB.id, 5);

    sessionFor(orgA.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ tenant: { firstName: "A", lastName: "B" }, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }),
      }),
      { params: Promise.resolve({ id: roomB.id }) }
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 when the existing tenant id belongs to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Tenant Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Tenant Guard" } });
    const room = await makeRoom(orgA.id, 1);
    const tenantB = await prisma.tenant.create({ data: { organizationId: orgB.id, firstName: "B", lastName: "Tenant", status: "PROSPECT" } });

    sessionFor(orgA.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ tenant: { id: tenantB.id }, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }),
      }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(404);
  });

  it("returns 409 when the existing tenant is not a PROSPECT", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Not Prospect" } });
    const room = await makeRoom(org.id, 1);
    const activeTenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "Already", lastName: "Active", status: "ACTIVE" } });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ tenant: { id: activeTenant.id }, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }),
      }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(409);
  });

  it.each([
    [{ tenant: {}, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }, "tenant.firstName is required"],
    [{ tenant: { firstName: "A" }, startDate: "2026-01-01", monthlyRate: 3000, depositAmount: 3000 }, "tenant.lastName is required"],
    [{ tenant: { firstName: "A", lastName: "B" }, startDate: "not-a-date", monthlyRate: 3000, depositAmount: 3000 }, "startDate must be a valid date"],
    [{ tenant: { firstName: "A", lastName: "B" }, startDate: "2026-01-01", depositAmount: 3000 }, "monthlyRate must be a non-negative number"],
    [{ tenant: { firstName: "A", lastName: "B" }, startDate: "2026-01-01", monthlyRate: 3000 }, "depositAmount must be a non-negative number"],
  ])("returns 400 for invalid body %j", async (body, expectedError) => {
    const org = await prisma.organization.create({ data: { name: `Org Admit Invalid ${JSON.stringify(body)}` } });
    const room = await makeRoom(org.id, 5);

    sessionFor(org.id);
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }), {
      params: Promise.resolve({ id: room.id }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe(expectedError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test -- tenancies`
Expected: FAIL — the foundational `$transaction` check test may pass or fail depending on whether `createScopedClient` is even importable at this point (it is, from the Foundation plan) but `Cannot find module '../route'` for the route tests.

- [ ] **Step 3: Implement the admission route**

`apps/web/src/app/api/rooms/[id]/tenancies/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;
  const { id: roomId } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { tenant, startDate, monthlyRate, depositAmount } = body as Record<string, unknown>;

  if (!tenant || typeof tenant !== "object") {
    return NextResponse.json({ error: "tenant is required" }, { status: 400 });
  }
  const tenantInput = tenant as Record<string, unknown>;
  const isExisting = typeof tenantInput.id === "string" && tenantInput.id.trim() !== "";
  if (!isExisting) {
    if (typeof tenantInput.firstName !== "string" || tenantInput.firstName.trim() === "") {
      return NextResponse.json({ error: "tenant.firstName is required" }, { status: 400 });
    }
    if (typeof tenantInput.lastName !== "string" || tenantInput.lastName.trim() === "") {
      return NextResponse.json({ error: "tenant.lastName is required" }, { status: 400 });
    }
  }
  if (typeof startDate !== "string" || Number.isNaN(Date.parse(startDate))) {
    return NextResponse.json({ error: "startDate must be a valid date" }, { status: 400 });
  }
  if (typeof monthlyRate !== "number" || monthlyRate < 0) {
    return NextResponse.json({ error: "monthlyRate must be a non-negative number" }, { status: 400 });
  }
  if (typeof depositAmount !== "number" || depositAmount < 0) {
    return NextResponse.json({ error: "depositAmount must be a non-negative number" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);

  const room = await scoped.room.findFirst({ where: { id: roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  try {
    const result = await scoped.$transaction(async (tx) => {
      const activeCount = await tx.tenancy.count({ where: { roomId: room.id, status: "ACTIVE" } });
      if (activeCount >= room.capacity) {
        throw new Error("ROOM_FULL");
      }

      let tenantRecord;
      if (isExisting) {
        const existingTenant = await tx.tenant.findFirst({ where: { id: tenantInput.id as string } });
        if (!existingTenant) throw new Error("TENANT_NOT_FOUND");
        if (existingTenant.status !== "PROSPECT") throw new Error("TENANT_NOT_PROSPECT");
        tenantRecord = await tx.tenant.update({ where: { id: existingTenant.id }, data: { status: "ACTIVE" } });
      } else {
        tenantRecord = await tx.tenant.create({
          data: {
            organizationId: session.organizationId,
            firstName: (tenantInput.firstName as string).trim(),
            lastName: (tenantInput.lastName as string).trim(),
            email:
              typeof tenantInput.email === "string" && tenantInput.email.trim() !== "" ? tenantInput.email.trim() : null,
            phone:
              typeof tenantInput.phone === "string" && tenantInput.phone.trim() !== "" ? tenantInput.phone.trim() : null,
            emergencyContact:
              typeof tenantInput.emergencyContact === "string" && tenantInput.emergencyContact.trim() !== ""
                ? tenantInput.emergencyContact.trim()
                : null,
            status: "ACTIVE",
          },
        });
      }

      const tenancy = await tx.tenancy.create({
        data: {
          organizationId: session.organizationId,
          tenantId: tenantRecord.id,
          roomId: room.id,
          startDate: new Date(startDate as string),
          monthlyRate: monthlyRate as number,
          depositAmount: depositAmount as number,
          status: "ACTIVE",
        },
      });

      return { tenant: tenantRecord, tenancy };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ROOM_FULL") {
      return NextResponse.json({ error: "Room has no free capacity" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "TENANT_NOT_PROSPECT") {
      return NextResponse.json({ error: "Tenant is not a prospect" }, { status: 409 });
    }
    throw error;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test`
Expected: PASS (all tests). If the foundational `$transaction` composability test fails, STOP — see the note above the tests; do not paper over it.

- [ ] **Step 5: Run `next build` to confirm no type errors**

Run: `cd apps/web && npx next build` (from repo root)
Expected: succeeds. `scoped.$transaction`'s callback parameter type may need an explicit type or a small cast to satisfy strict TypeScript depending on how Prisma's extended-client types resolve here — if so, apply the smallest fix that keeps the transaction's runtime behavior unchanged (mirroring how the Buildings plan handled the `createScopedClient` extension's own typing issues), and explain the fix in your report.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/rooms/[id]/tenancies
git commit -m "feat(web): add tenant admission API with transactional Tenant+Tenancy writes"
```

---

## Task 4: End-Tenancy API

**Files:**
- Create: `apps/web/src/app/api/tenancies/[id]/end/route.ts`
- Test: `apps/web/src/app/api/tenancies/[id]/end/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `requireOrgSession`, `createScopedClient` (Foundation plan).
- Produces: `POST /api/tenancies/[id]/end` — Task 5's tenant detail page's "End Tenancy" button posts here. Response shape `{ tenancy, tenant }`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/app/api/tenancies/[id]/end/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { POST } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

async function makeActiveTenancy(organizationId: string) {
  const building = await prisma.building.create({ data: { organizationId, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId, buildingId: building.id, label: "1F" } });
  const room = await prisma.room.create({ data: { organizationId, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" } });
  const tenant = await prisma.tenant.create({ data: { organizationId, firstName: "A", lastName: "Tenant", status: "ACTIVE" } });
  const tenancy = await prisma.tenancy.create({
    data: { organizationId, tenantId: tenant.id, roomId: room.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
  });
  return { room, tenant, tenancy };
}

describe("POST /api/tenancies/[id]/end", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("ends a tenancy, sets endDate, and moves the tenant to MOVED_OUT, freeing the room", async () => {
    const org = await prisma.organization.create({ data: { name: "Org End Tenancy" } });
    const { room, tenant, tenancy } = await makeActiveTenancy(org.id);

    sessionFor(org.id);
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: tenancy.id }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tenancy.status).toBe("ENDED");
    expect(data.tenancy.endDate).not.toBeNull();
    expect(data.tenant.status).toBe("MOVED_OUT");

    const activeCount = await prisma.tenancy.count({ where: { roomId: room.id, status: "ACTIVE" } });
    expect(activeCount).toBe(0);
    const refetchedTenant = await prisma.tenant.findFirst({ where: { id: tenant.id } });
    expect(refetchedTenant?.status).toBe("MOVED_OUT");
  });

  it("returns 404 when the tenancy belongs to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A End Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B End Guard" } });
    const { tenancy: tenancyB } = await makeActiveTenancy(orgB.id);

    sessionFor(orgA.id);
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: tenancyB.id }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 409 when the tenancy is already ended", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Already Ended" } });
    const { tenancy } = await makeActiveTenancy(org.id);
    await prisma.tenancy.update({ where: { id: tenancy.id }, data: { status: "ENDED", endDate: new Date() } });

    sessionFor(org.id);
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: tenancy.id }),
    });

    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test -- end`
Expected: FAIL with `Cannot find module '../route'`.

- [ ] **Step 3: Implement the end-tenancy route**

`apps/web/src/app/api/tenancies/[id]/end/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;
  const { id } = await params;

  const scoped = createScopedClient(session.organizationId);
  const tenancy = await scoped.tenancy.findFirst({ where: { id } });
  if (!tenancy) return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });
  if (tenancy.status === "ENDED") {
    return NextResponse.json({ error: "Tenancy already ended" }, { status: 409 });
  }

  const result = await scoped.$transaction(async (tx) => {
    const endedTenancy = await tx.tenancy.update({
      where: { id: tenancy.id },
      data: { status: "ENDED", endDate: new Date() },
    });
    const tenant = await tx.tenant.update({
      where: { id: tenancy.tenantId },
      data: { status: "MOVED_OUT" },
    });
    return { tenancy: endedTenancy, tenant };
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test`
Expected: PASS (all tests).

- [ ] **Step 5: Run `next build` to confirm no type errors**

Run: `cd apps/web && npx next build` (from repo root)
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/tenancies
git commit -m "feat(web): add end-tenancy API, freeing the room and moving tenant to MOVED_OUT"
```

---

## Task 5: Tenants List & Detail UI

**Files:**
- Create: `apps/web/src/app/dashboard/tenants/page.tsx`
- Create: `apps/web/src/app/dashboard/tenants/AddProspectForm.tsx`
- Create: `apps/web/src/app/dashboard/tenants/[id]/page.tsx`
- Create: `apps/web/src/app/dashboard/tenants/[id]/EndTenancyButton.tsx`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`, `createScopedClient` from `@mytenants/db`, and the API routes from Tasks 1-4.
- Produces: `/dashboard/tenants` and `/dashboard/tenants/[id]` — Task 6's admission flow links back here after a successful admission (or the tenant detail page for an already-admitted tenant links here too).

- [ ] **Step 1: Tenants list page with search/status filter and an "add prospect" form**

`apps/web/src/app/dashboard/tenants/AddProspectForm.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddProspectForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName }),
    });
    if (res.ok) {
      setFirstName("");
      setLastName("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add prospect");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-6">
      <div>
        <label className="block text-sm">
          First name
          <input
            className="border rounded px-2 py-1 block"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <label className="block text-sm">
          Last name
          <input
            className="border rounded px-2 py-1 block"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </label>
      </div>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-black text-white rounded px-3 py-1">
        Add Prospect
      </button>
    </form>
  );
}
```

`apps/web/src/app/dashboard/tenants/page.tsx`:
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { AddProspectForm } from "./AddProspectForm";

export default async function TenantsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const { status, search } = await searchParams;
  const TENANT_STATUSES = ["PROSPECT", "ACTIVE", "MOVED_OUT"] as const;
  const validStatus = status && (TENANT_STATUSES as readonly string[]).includes(status) ? status : undefined;

  const scoped = createScopedClient(session.user.organizationId);
  const tenants = await scoped.tenant.findMany({
    where: {
      ...(validStatus ? { status: validStatus as (typeof TENANT_STATUSES)[number] } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Tenants</h1>
      <Link className="text-blue-700 underline mb-4 inline-block" href="/dashboard/tenants/admit">
        Admit Tenant
      </Link>
      <AddProspectForm />
      <form className="mb-4 flex gap-2" method="get">
        <input name="search" defaultValue={search ?? ""} placeholder="Search by name" className="border rounded px-2 py-1" />
        <select name="status" defaultValue={status ?? ""} className="border rounded px-2 py-1">
          <option value="">All statuses</option>
          <option value="PROSPECT">Prospect</option>
          <option value="ACTIVE">Active</option>
          <option value="MOVED_OUT">Moved out</option>
        </select>
        <button type="submit" className="border rounded px-3 py-1">Filter</button>
      </form>
      <ul className="space-y-2">
        {tenants.map((tenant) => (
          <li key={tenant.id}>
            <Link className="text-blue-700 underline" href={`/dashboard/tenants/${tenant.id}`}>
              {tenant.firstName} {tenant.lastName}
            </Link>
            <span className="text-gray-500 text-sm"> — {tenant.status}</span>
          </li>
        ))}
        {tenants.length === 0 && <li className="text-gray-500">No tenants found.</li>}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Tenant detail page with tenancy history and "End Tenancy"**

`apps/web/src/app/dashboard/tenants/[id]/EndTenancyButton.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EndTenancyButton({ tenancyId }: { tenancyId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!confirm("End this tenancy? This will mark the tenant as moved out.")) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/tenancies/${tenancyId}/end`, { method: "POST" });
    setPending(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to end tenancy");
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={pending} className="bg-red-700 text-white rounded px-3 py-1">
        End Tenancy
      </button>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
```

`apps/web/src/app/dashboard/tenants/[id]/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { EndTenancyButton } from "./EndTenancyButton";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const scoped = createScopedClient(session.user.organizationId);
  const tenant = await scoped.tenant.findFirst({
    where: { id },
    include: {
      tenancies: {
        orderBy: { startDate: "desc" },
        include: { room: { include: { floor: { include: { building: true } } } } },
      },
    },
  });

  if (!tenant) {
    return (
      <main className="p-6">
        <p>Tenant not found.</p>
      </main>
    );
  }

  const activeTenancy = tenant.tenancies.find((t) => t.status === "ACTIVE");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">
        {tenant.firstName} {tenant.lastName}
      </h1>
      <p className="text-gray-500 mb-4">{tenant.status}</p>
      {tenant.email && <p>Email: {tenant.email}</p>}
      {tenant.phone && <p>Phone: {tenant.phone}</p>}
      {tenant.emergencyContact && <p>Emergency contact: {tenant.emergencyContact}</p>}

      {activeTenancy && (
        <div className="mt-4">
          <p>
            Currently in {activeTenancy.room.floor.building.name} / {activeTenancy.room.floor.label} / {activeTenancy.room.name}
          </p>
          <EndTenancyButton tenancyId={activeTenancy.id} />
        </div>
      )}

      <h2 className="text-lg font-medium mt-6 mb-2">Tenancy History</h2>
      <ul className="space-y-1">
        {tenant.tenancies.map((tenancy) => (
          <li key={tenancy.id} data-testid="tenancy-row">
            {tenancy.room.floor.building.name} / {tenancy.room.floor.label} / {tenancy.room.name} —{" "}
            {tenancy.status}
          </li>
        ))}
        {tenant.tenancies.length === 0 && <li className="text-gray-500">No tenancy history yet.</li>}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Run the full suite**

Run: `pnpm --filter web test` — Expected: PASS (all tests).
Run: `cd apps/web && npx next build` (from repo root) — Expected: succeeds. Note that `searchParams` on a page component is also a `Promise` in Next.js 15 (`Promise<{ status?: string; search?: string }>`), same as dynamic-segment `params` — the list page above already follows this.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/tenants
git commit -m "feat(web): add tenants list/search/filter UI and tenant detail page with end-tenancy"
```

---

## Task 6: Admission Wizard UI and End-to-End Coverage

**Files:**
- Create: `apps/web/src/app/dashboard/tenants/admit/page.tsx`
- Create: `apps/web/src/app/dashboard/tenants/admit/AdmitTenantForm.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx` (add a nav link to `/dashboard/tenants`)
- Create: `apps/web/e2e/tenant-admission.spec.ts`

**Interfaces:**
- Consumes: `getAvailableRooms` (Task 2), `POST /api/rooms/[id]/tenancies` (Task 3), `auth`/`createScopedClient` (Foundation plan).
- Produces: `/dashboard/tenants/admit` — the page other UI (Task 5's tenants list, and later the Buildings plan's room cards in a future pass) links into.

- [ ] **Step 1: The admission form**

`apps/web/src/app/dashboard/tenants/admit/AdmitTenantForm.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AvailableRoom } from "@/lib/availableRooms";

type Prospect = { id: string; firstName: string; lastName: string };

export function AdmitTenantForm({
  availableRooms,
  prospects,
}: {
  availableRooms: AvailableRoom[];
  prospects: Prospect[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [roomId, setRoomId] = useState(availableRooms[0]?.roomId ?? "");
  const [prospectId, setProspectId] = useState(prospects[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("0");
  const [depositAmount, setDepositAmount] = useState("0");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const tenant = mode === "existing" ? { id: prospectId } : { firstName, lastName };

    const res = await fetch(`/api/rooms/${roomId}/tenancies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant,
        startDate,
        monthlyRate: Number(monthlyRate),
        depositAmount: Number(depositAmount),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/tenants/${data.tenant.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to admit tenant");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <fieldset>
        <legend className="text-sm font-medium">Tenant</legend>
        <label className="block text-sm">
          <input type="radio" name="mode" checked={mode === "new"} onChange={() => setMode("new")} /> New tenant
        </label>
        <label className="block text-sm">
          <input type="radio" name="mode" checked={mode === "existing"} onChange={() => setMode("existing")} /> Existing prospect
        </label>
      </fieldset>

      {mode === "new" ? (
        <>
          <label className="block text-sm">
            First name
            <input className="border rounded px-2 py-1 block" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </label>
          <label className="block text-sm">
            Last name
            <input className="border rounded px-2 py-1 block" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
        </>
      ) : (
        <label className="block text-sm">
          Prospect
          <select className="border rounded px-2 py-1 block" value={prospectId} onChange={(e) => setProspectId(e.target.value)} required>
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-sm">
        Room
        <select className="border rounded px-2 py-1 block" value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
          {availableRooms.map((room) => (
            <option key={room.roomId} value={room.roomId}>
              {room.buildingName} / {room.floorLabel} / {room.roomName} ({room.occupied}/{room.capacity})
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Start date
        <input type="date" className="border rounded px-2 py-1 block" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
      </label>
      <label className="block text-sm">
        Monthly rate
        <input type="number" min={0} className="border rounded px-2 py-1 block" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} required />
      </label>
      <label className="block text-sm">
        Deposit amount
        <input type="number" min={0} className="border rounded px-2 py-1 block" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} required />
      </label>

      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-black text-white rounded px-3 py-1">
        Admit Tenant
      </button>
    </form>
  );
}
```

`apps/web/src/app/dashboard/tenants/admit/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { getAvailableRooms } from "@/lib/availableRooms";
import { AdmitTenantForm } from "./AdmitTenantForm";

export default async function AdmitTenantPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const scoped = createScopedClient(session.user.organizationId);
  const [availableRooms, prospects] = await Promise.all([
    getAvailableRooms(scoped),
    scoped.tenant.findMany({ where: { status: "PROSPECT" }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Admit Tenant</h1>
      {availableRooms.length === 0 ? (
        <p className="text-gray-500">No rooms with free capacity. Add a building/floor/room first.</p>
      ) : (
        <AdmitTenantForm availableRooms={availableRooms} prospects={prospects} />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Wire the dashboard nav**

In `apps/web/src/app/dashboard/layout.tsx`, add a link to `/dashboard/tenants` in the existing `<header>` next to the Buildings link (import `Link` from `next/link` if not already imported there) — keep the existing session-check logic untouched.

- [ ] **Step 3: Write the end-to-end test**

`apps/web/e2e/tenant-admission.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("admit a new tenant into a room, see occupancy update, then end the tenancy and see it freed", async ({ page }) => {
  const email = `tenant-admission-e2e-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByPlaceholder("Organization name").fill("Tenant Admission E2E Org");
  await page.getByPlaceholder("Your name").fill("E2E Owner");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Set up a building/floor/room to admit into.
  await page.goto("/dashboard/buildings");
  await page.getByLabel("Name").fill("Admission Hall");
  await page.getByRole("button", { name: "Add Building" }).click();
  await page.getByRole("link", { name: "Admission Hall" }).click();
  await page.getByLabel("Floor label").fill("1F");
  await page.getByRole("button", { name: "Add Floor" }).click();
  await page.getByLabel("Room name").fill("101");
  await page.getByLabel("Capacity").fill("1");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByRole("button", { name: "Add Room" }).click();
  await expect(page.getByTestId("room-card")).toContainText("0/1");

  // Admit a new tenant into that room.
  await page.goto("/dashboard/tenants/admit");
  await page.getByLabel("First name").fill("Jane");
  await page.getByLabel("Last name").fill("Doe");
  await page.getByLabel("Start date").fill("2026-01-01");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByLabel("Deposit amount").fill("3000");
  await page.getByRole("button", { name: "Admit Tenant" }).click();
  await expect(page).toHaveURL(/\/dashboard\/tenants\/.+/);
  await expect(page.getByRole("heading", { name: "Jane Doe" })).toBeVisible();

  // The room in the buildings grid should now show 1/1 (full).
  await page.goto("/dashboard/buildings");
  await page.getByRole("link", { name: "Admission Hall" }).click();
  const roomCard = page.getByTestId("room-card");
  await expect(roomCard).toContainText("1/1");
  await expect(roomCard).toHaveAttribute("data-status", "full");

  // End the tenancy and confirm the room frees up again.
  await page.goto("/dashboard/tenants");
  await page.getByRole("link", { name: "Jane Doe" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "End Tenancy" }).click();
  await expect(page.getByText("MOVED_OUT")).toBeVisible();

  await page.goto("/dashboard/buildings");
  await page.getByRole("link", { name: "Admission Hall" }).click();
  await expect(page.getByTestId("room-card")).toContainText("0/1");
});
```

- [ ] **Step 4: Run the full suite**

Run: `pnpm --filter web test` — Expected: PASS (all unit tests).
Run: `pnpm --filter web test:e2e` — Expected: PASS (this new test plus the Foundation/Buildings plans' existing E2E tests). This runs against a production build per the Buildings plan's `playwright.config.ts` fix — if you change any page/component in this task, a fresh `pnpm build` runs automatically as part of `test:e2e`'s `webServer` step, so no separate manual rebuild is needed.
Run: `cd apps/web && npx next build` (from repo root) — Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/tenants/admit apps/web/src/app/dashboard/layout.tsx apps/web/e2e/tenant-admission.spec.ts
git commit -m "feat(web): add tenant admission wizard UI with e2e coverage"
```

---

## Plan Self-Review Notes

- **Spec coverage:** §6.2 (Admitting a Tenant — new-or-existing-prospect, room picker limited to free-capacity rooms, one-transaction creation, immediate occupancy reflection) is implemented end-to-end. §6.1 (Tenant CRUD & Info Management) is only partially implemented in the UI layer: list/search/filter is implemented end-to-end, but profile-editing UI and building/room-filter UI are NOT implemented — `PATCH /api/tenants/[id]` exists and is tested but has zero UI consumers (no edit form on the tenant detail page), and the buildingId filter is API-only with no filter control on the tenants list page. Both APIs support the functionality; only the UI surface is missing, left for a future plan. §6.1's "payment history, notification history" on the detail page are correctly deferred — those sections don't exist until the payments/notifications plans land; the current detail page only shows what this plan builds (profile + tenancy history).
- **Constraints followed:** every Tenant/Tenancy write goes through `requireOrgSession()` + a scoped client; the two multi-model writes (admission, end-tenancy) are sequential top-level calls inside `scoped.$transaction`, never nested; every parent id (`roomId`, `tenancyId`) is validated via scoped lookup before use; `PATCH /api/tenants/[id]` never accepts `status`; every dynamic route uses `Promise<{id:string}>` params; every `.create()` includes the type-satisfying `organizationId` literal; every form label wraps its input.
- **The plan's one genuinely new, unverified assumption** — that `scoped.$transaction(async (tx) => {...})` preserves org-scoping inside the callback — is called out explicitly in Task 3 with its own dedicated test and an instruction to stop and escalate rather than route around it if it doesn't hold, since every other multi-model write in this plan (and likely future plans) depends on the same pattern.
- **Type consistency:** `AvailableRoom`'s fields (`roomId`, `roomName`, `floorLabel`, `buildingId`, `buildingName`, `capacity`, `occupied`, `monthlyRate`) are the exact shape Task 6's form destructures. The admission API's response shape (`{ tenant, tenancy }`) matches what Task 6's form reads (`data.tenant.id`) and what Task 4's end-tenancy response also uses for consistency.
