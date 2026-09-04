# Building & Room Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a landlord set up a building's floors and rooms, and see a live, org-isolated occupancy overview (floors → room cards, color-coded by vacancy) — the second feature plan built on the Foundation plan's schema, auth, and org-scoping.

**Architecture:** All new work lives in `apps/web` (the `Building`/`Floor`/`Room` schema already exists from the Foundation plan). Every new API route follows one pattern: authenticate → get a `createScopedClient(organizationId)` → for anything with a parent (a Floor's Building, a Room's Floor), explicitly verify the parent belongs to the caller's org via a scoped `findFirst` before writing. This is the parent-FK-validation rule from `docs/superpowers/specs/2026-09-04-foundation-constraints.md`. No nested Prisma writes across these models — each create is a single top-level scoped call, per that same document's nested-writes rule.

**Tech Stack:** Next.js 15 (App Router), Prisma (existing schema), Vitest, Playwright. Adds Tailwind CSS (already an installed-but-unused dependency from the Foundation plan) as the styling approach for this and future feature UI.

**Spec:** `docs/superpowers/specs/2026-09-04-mytenants-design.md` (see §5 Core Data Model, §6.5 Building/Dorm Overview)
**Constraints:** `docs/superpowers/specs/2026-09-04-foundation-constraints.md` — binding on every task in this plan.

## Global Constraints

- Every route that accepts a user-supplied parent id (a `buildingId` when creating a Floor, a `floorId` when creating a Room) MUST verify that parent belongs to the caller's organization via a scoped `findFirst` lookup before using it in a write. Returning 404 (not 403) when the parent doesn't belong to the caller — don't reveal whether the id exists at all.
- No nested Prisma writes across `Building`/`Floor`/`Room`/`Tenancy` (e.g. no `building.create({ data: { floors: { create: [...] } } })`). Each entity is created via its own top-level scoped call.
- Org-scoped models are queried via `findFirst`/`findMany`, never `findUnique` (the scoping extension throws on `findUnique`).
- No API route may skip the auth check — `/api/*` routes are NOT covered by `middleware.ts`'s matcher, so every new route handler in this plan calls the shared `requireOrgSession()` helper (built in Task 1) as its first line.
- No bed/slot-level occupancy — occupancy is room-capacity-level only (count of `ACTIVE` Tenancies per room vs. `Room.capacity`), per the spec's v1 non-goals.
- No deletion of Buildings/Floors/Rooms in this plan (YAGNI — nothing yet depends on it, and deleting a room with tenancies needs business rules the tenant-admission plan hasn't defined yet). Only create + list + get + rename/edit.

---

## Task 1: Auth-Guard Helper, Tailwind Setup, Building CRUD API

**Files:**
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx` (import `./globals.css`)
- Modify: `apps/web/package.json` (add `tailwindcss`/`postcss`/`autoprefixer` — already present as devDependencies from the Foundation plan; confirm, don't duplicate)
- Create: `apps/web/src/lib/requireOrgSession.ts`
- Test: `apps/web/src/lib/__tests__/requireOrgSession.test.ts`
- Create: `apps/web/src/app/api/buildings/route.ts`
- Create: `apps/web/src/app/api/buildings/[id]/route.ts`
- Test: `apps/web/src/app/api/buildings/__tests__/route.test.ts`
- Test: `apps/web/src/app/api/buildings/[id]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`, `createScopedClient` from `@mytenants/db` (both from the Foundation plan).
- Produces: `requireOrgSession(): Promise<{ ok: true; organizationId: string; userId: string } | { ok: false; response: NextResponse }>` — every later task's route handlers start with `const session = await requireOrgSession(); if (!session.ok) return session.response;`. Also produces the `Building` CRUD routes (`GET`/`POST /api/buildings`, `GET`/`PATCH /api/buildings/[id]`) that Task 4/5 read from.

- [ ] **Step 1: Tailwind setup**

`apps/web/tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

`apps/web/postcss.config.js`:
```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

`apps/web/src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

In `apps/web/src/app/layout.tsx`, add `import "./globals.css";` as the first line (keep the rest of the file as-is).

Check `apps/web/package.json` already lists `tailwindcss`, `postcss`, `autoprefixer` in `devDependencies` (it does, from the Foundation plan) — no install needed, just these config files.

- [ ] **Step 2: Write the failing test for `requireOrgSession`**

`apps/web/src/lib/__tests__/requireOrgSession.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth", () => ({ auth: vi.fn() }));

import { auth } from "../auth";
import { requireOrgSession } from "../requireOrgSession";

describe("requireOrgSession", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns ok:false with a 401 response when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await requireOrgSession();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns ok:false with a 401 response when the session has no organizationId", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as never);

    const result = await requireOrgSession();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns ok:true with organizationId and userId when a valid session exists", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { organizationId: "org-1", id: "user-1", role: "OWNER" },
    } as never);

    const result = await requireOrgSession();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.organizationId).toBe("org-1");
      expect(result.userId).toBe("user-1");
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter web test -- requireOrgSession`
Expected: FAIL with `Cannot find module '../requireOrgSession'`.

- [ ] **Step 4: Implement `requireOrgSession`**

`apps/web/src/lib/requireOrgSession.ts`:
```ts
import { NextResponse } from "next/server";
import { auth } from "./auth";

type OrgSession =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; response: NextResponse };

export async function requireOrgSession(): Promise<OrgSession> {
  const session = await auth();

  if (!session?.user?.organizationId || !session.user.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true, organizationId: session.user.organizationId, userId: session.user.id };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter web test -- requireOrgSession`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing tests for the Building list/create API**

`apps/web/src/app/api/buildings/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { GET, POST } from "../route";

function sessionFor(organizationId: string, userId = "user-1") {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: userId, role: "OWNER" },
  } as never);
}

describe("GET/POST /api/buildings", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("creates a building and only lists it for the same organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Buildings" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Buildings" } });

    sessionFor(orgA.id);
    const createRes = await POST(
      new Request("http://localhost/api/buildings", {
        method: "POST",
        body: JSON.stringify({ name: "Main Hall", address: "123 Street" }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.building.name).toBe("Main Hall");
    expect(created.building.organizationId).toBe(orgA.id);

    const listResA = await GET();
    const listedA = await listResA.json();
    expect(listedA.buildings).toHaveLength(1);
    expect(listedA.buildings[0].name).toBe("Main Hall");

    sessionFor(orgB.id);
    const listResB = await GET();
    const listedB = await listResB.json();
    expect(listedB.buildings).toHaveLength(0);
  });

  it("returns 400 when name is missing", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Missing Name" } });
    sessionFor(org.id);

    const res = await POST(
      new Request("http://localhost/api/buildings", { method: "POST", body: JSON.stringify({}) })
    );

    expect(res.status).toBe(400);
  });
});
```

`apps/web/src/app/api/buildings/[id]/__tests__/route.test.ts`:
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

describe("GET/PATCH /api/buildings/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 404 for a building belonging to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Detail" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Detail" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });

    sessionFor(orgA.id);
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: buildingB.id }) });

    expect(res.status).toBe(404);
  });

  it("updates a building's name for its own organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Update" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Old Name" } });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ name: "New Name" }) }),
      { params: Promise.resolve({ id: building.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.building.name).toBe("New Name");
  });

  it("returns 404 when trying to update another organization's building", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Update Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Update Guard" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall Guard" } });

    sessionFor(orgA.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ name: "Hijacked" }) }),
      { params: Promise.resolve({ id: buildingB.id }) }
    );

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `pnpm --filter web test -- buildings`
Expected: FAIL with `Cannot find module '../route'` (routes don't exist yet).

- [ ] **Step 8: Implement the Building CRUD routes**

`apps/web/src/app/api/buildings/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function GET() {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const scoped = createScopedClient(session.organizationId);
  const buildings = await scoped.building.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ buildings });
}

export async function POST(request: Request) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const building = await scoped.building.create({
    data: {
      name: body.name.trim(),
      address: typeof body.address === "string" && body.address.trim() !== "" ? body.address.trim() : null,
    },
  });
  return NextResponse.json({ building }, { status: 201 });
}
```

`apps/web/src/app/api/buildings/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const scoped = createScopedClient(session.organizationId);
  const building = await scoped.building.findFirst({ where: { id } });
  if (!building) return NextResponse.json({ error: "Building not found" }, { status: 404 });

  return NextResponse.json({ building });
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
  const existing = await scoped.building.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Building not found" }, { status: 404 });

  const data: { name?: string; address?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim() !== "") data.name = body.name.trim();
  if (typeof body.address === "string") data.address = body.address.trim() === "" ? null : body.address.trim();

  const building = await scoped.building.update({ where: { id }, data });
  return NextResponse.json({ building });
}
```

**Note (Next.js 15 async params):** Route Handler and page dynamic-segment `params` are a `Promise` in Next.js 15 (`{ params: Promise<{ id: string }> }`, resolved via `const { id } = await params;`) — every dynamic route in this plan follows this pattern. Test call-sites correspondingly pass `{ params: Promise.resolve({ id: someId }) }` rather than a bare object, so they satisfy the handler's `Promise<{id:string}>` parameter type under strict TypeScript (a bare object works at runtime via `await`, but doesn't structurally match `Promise<T>` for the type checker).

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm --filter web test`
Expected: PASS (all tests, including the new ones — 3 requireOrgSession + 3 buildings-list + 3 buildings-detail, plus all pre-existing tests from the Foundation plan).

- [ ] **Step 10: Commit**

```bash
git add apps/web/tailwind.config.ts apps/web/postcss.config.js apps/web/src/app/globals.css apps/web/src/app/layout.tsx apps/web/src/lib/requireOrgSession.ts apps/web/src/lib/__tests__/requireOrgSession.test.ts apps/web/src/app/api/buildings
git commit -m "feat(web): add Tailwind setup, org-session guard, and Building CRUD API"
```

---

## Task 2: Floor CRUD API

**Files:**
- Create: `apps/web/src/app/api/buildings/[id]/floors/route.ts`
- Test: `apps/web/src/app/api/buildings/[id]/floors/__tests__/route.test.ts`
- Create: `apps/web/src/app/api/floors/[id]/route.ts`
- Test: `apps/web/src/app/api/floors/[id]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `requireOrgSession` from `@/lib/requireOrgSession`, `createScopedClient` from `@mytenants/db` (Task 1).
- Produces: `POST /api/buildings/[id]/floors` (create), `PATCH /api/floors/[id]` (rename) — Task 4's `getBuildingOverview` reads the `Floor` rows these create; Task 5's UI calls these directly.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/app/api/buildings/[id]/floors/__tests__/route.test.ts`:
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

describe("POST /api/buildings/[id]/floors", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("creates a floor under a building belonging to the caller's organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Floor Create" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ label: "1F" }) }),
      { params: Promise.resolve({ id: building.id }) }
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.floor.label).toBe("1F");
    expect(data.floor.buildingId).toBe(building.id);
    expect(data.floor.organizationId).toBe(org.id);
  });

  it("returns 404 (not 403) when the building belongs to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Floor Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Floor Guard" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });

    sessionFor(orgA.id);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ label: "1F" }) }),
      { params: Promise.resolve({ id: buildingB.id }) }
    );

    expect(res.status).toBe(404);
    const created = await prisma.floor.findFirst({ where: { buildingId: buildingB.id } });
    expect(created).toBeNull();
  });

  it("returns 400 when label is missing", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Floor Missing Label" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: building.id }) }
    );

    expect(res.status).toBe(400);
  });
});
```

`apps/web/src/app/api/floors/[id]/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { PATCH } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

describe("PATCH /api/floors/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("renames a floor belonging to the caller's organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Floor Rename" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "Old" } });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ label: "New" }) }),
      { params: Promise.resolve({ id: floor.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.floor.label).toBe("New");
  });

  it("returns 404 when renaming another organization's floor", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Floor Rename Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Floor Rename Guard" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });
    const floorB = await prisma.floor.create({ data: { organizationId: orgB.id, buildingId: buildingB.id, label: "B1F" } });

    sessionFor(orgA.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ label: "Hijacked" }) }),
      { params: Promise.resolve({ id: floorB.id }) }
    );

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test -- floors`
Expected: FAIL with `Cannot find module '../route'`.

- [ ] **Step 3: Implement the Floor routes**

`apps/web/src/app/api/buildings/[id]/floors/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.label !== "string" || body.label.trim() === "") {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);

  const building = await scoped.building.findFirst({ where: { id } });
  if (!building) return NextResponse.json({ error: "Building not found" }, { status: 404 });

  const floor = await scoped.floor.create({
    data: { buildingId: building.id, label: body.label.trim() },
  });
  return NextResponse.json({ floor }, { status: 201 });
}
```

`apps/web/src/app/api/floors/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.label !== "string" || body.label.trim() === "") {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const existing = await scoped.floor.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Floor not found" }, { status: 404 });

  const floor = await scoped.floor.update({ where: { id }, data: { label: body.label.trim() } });
  return NextResponse.json({ floor });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/buildings/[id]/floors apps/web/src/app/api/floors
git commit -m "feat(web): add Floor CRUD API with parent-ownership validation"
```

---

## Task 3: Room CRUD API

**Files:**
- Create: `apps/web/src/app/api/floors/[id]/rooms/route.ts`
- Test: `apps/web/src/app/api/floors/[id]/rooms/__tests__/route.test.ts`
- Create: `apps/web/src/app/api/rooms/[id]/route.ts`
- Test: `apps/web/src/app/api/rooms/[id]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `requireOrgSession`, `createScopedClient` (Task 1).
- Produces: `POST /api/floors/[id]/rooms` (create), `PATCH /api/rooms/[id]` (edit name/capacity/rate) — Task 4's `getBuildingOverview` reads the `Room` rows these create; Task 5's UI calls these directly.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/app/api/floors/[id]/rooms/__tests__/route.test.ts`:
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

describe("POST /api/floors/[id]/rooms", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("creates a room under a floor belonging to the caller's organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Room Create" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "101", capacity: 2, monthlyRate: 3000 }),
      }),
      { params: Promise.resolve({ id: floor.id }) }
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.room.name).toBe("101");
    expect(data.room.capacity).toBe(2);
    expect(data.room.floorId).toBe(floor.id);
    expect(data.room.organizationId).toBe(org.id);
  });

  it("returns 404 when the floor belongs to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Room Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Room Guard" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });
    const floorB = await prisma.floor.create({ data: { organizationId: orgB.id, buildingId: buildingB.id, label: "B1F" } });

    sessionFor(orgA.id);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "101", capacity: 2, monthlyRate: 3000 }),
      }),
      { params: Promise.resolve({ id: floorB.id }) }
    );

    expect(res.status).toBe(404);
    const created = await prisma.room.findFirst({ where: { floorId: floorB.id } });
    expect(created).toBeNull();
  });

  it.each([
    [{ capacity: 2, monthlyRate: 3000 }, "name is required"],
    [{ name: "101", monthlyRate: 3000 }, "capacity must be a positive integer"],
    [{ name: "101", capacity: 0, monthlyRate: 3000 }, "capacity must be a positive integer"],
    [{ name: "101", capacity: 2 }, "monthlyRate must be a non-negative number"],
    [{ name: "101", capacity: 2, monthlyRate: -5 }, "monthlyRate must be a non-negative number"],
  ])("returns 400 for invalid body %j", async (body, expectedError) => {
    const org = await prisma.organization.create({ data: { name: `Org Room Invalid ${JSON.stringify(body)}` } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: floor.id }) }
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe(expectedError);
  });
});
```

`apps/web/src/app/api/rooms/[id]/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { PATCH } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

describe("PATCH /api/rooms/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("updates a room's capacity and rate for its own organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Room Update" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 2, monthlyRate: "3000.00" },
    });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ capacity: 3, monthlyRate: 3500 }) }),
      { params: Promise.resolve({ id: room.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.room.capacity).toBe(3);
  });

  it("returns 404 when updating another organization's room", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Room Update Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Room Update Guard" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });
    const floorB = await prisma.floor.create({ data: { organizationId: orgB.id, buildingId: buildingB.id, label: "B1F" } });
    const roomB = await prisma.room.create({
      data: { organizationId: orgB.id, floorId: floorB.id, name: "B101", capacity: 2, monthlyRate: "3000.00" },
    });

    sessionFor(orgA.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ capacity: 99 }) }),
      { params: Promise.resolve({ id: roomB.id }) }
    );

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test -- rooms`
Expected: FAIL with `Cannot find module '../route'`.

- [ ] **Step 3: Implement the Room routes**

`apps/web/src/app/api/floors/[id]/rooms/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof body.capacity !== "number" || !Number.isInteger(body.capacity) || body.capacity < 1) {
    return NextResponse.json({ error: "capacity must be a positive integer" }, { status: 400 });
  }
  if (typeof body.monthlyRate !== "number" || body.monthlyRate < 0) {
    return NextResponse.json({ error: "monthlyRate must be a non-negative number" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);

  const floor = await scoped.floor.findFirst({ where: { id } });
  if (!floor) return NextResponse.json({ error: "Floor not found" }, { status: 404 });

  const room = await scoped.room.create({
    data: {
      floorId: floor.id,
      name: body.name.trim(),
      capacity: body.capacity,
      monthlyRate: body.monthlyRate,
    },
  });
  return NextResponse.json({ room }, { status: 201 });
}
```

`apps/web/src/app/api/rooms/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const existing = await scoped.room.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const data: { name?: string; capacity?: number; monthlyRate?: number } = {};
  if (typeof body.name === "string" && body.name.trim() !== "") data.name = body.name.trim();
  if (typeof body.capacity === "number" && Number.isInteger(body.capacity) && body.capacity >= 1) {
    data.capacity = body.capacity;
  }
  if (typeof body.monthlyRate === "number" && body.monthlyRate >= 0) data.monthlyRate = body.monthlyRate;

  const room = await scoped.room.update({ where: { id }, data });
  return NextResponse.json({ room });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/floors/[id]/rooms apps/web/src/app/api/rooms
git commit -m "feat(web): add Room CRUD API with parent-ownership validation"
```

---

## Task 4: Occupancy Computation

**Files:**
- Create: `apps/web/src/lib/buildingOverview.ts`
- Test: `apps/web/src/lib/__tests__/buildingOverview.test.ts`

**Interfaces:**
- Consumes: `createScopedClient` from `@mytenants/db` (Task 1), the `Building`/`Floor`/`Room` rows created by Tasks 1-3, and the `Tenancy` model (already in the schema from the Foundation plan, unused by any UI yet).
- Produces: `getBuildingOverview(scoped: ReturnType<typeof createScopedClient>, buildingId: string): Promise<BuildingOverview | null>`, and the exported `BuildingOverview`/`FloorOverview`/`RoomOccupancy` types — Task 5's building detail page renders directly from this.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/__tests__/buildingOverview.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { prisma, createScopedClient } from "@mytenants/db";
import { getBuildingOverview } from "../buildingOverview";

describe("getBuildingOverview", () => {
  it("returns null for a building in another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Overview Null" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Overview Null" } });
    const buildingB = await prisma.building.create({ data: { organizationId: orgB.id, name: "B Hall" } });

    const scopedA = createScopedClient(orgA.id);
    const result = await getBuildingOverview(scopedA, buildingB.id);

    expect(result).toBeNull();
  });

  it("computes occupancy from ACTIVE tenancies only, ignoring ENDED ones and other rooms", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Overview Full" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Main Hall" } });
    const floor1 = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const floor2 = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "2F" } });

    const fullRoom = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor1.id, name: "101", capacity: 2, monthlyRate: "3000.00" },
    });
    const partialRoom = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor1.id, name: "102", capacity: 2, monthlyRate: "3000.00" },
    });
    const vacantRoom = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor2.id, name: "201", capacity: 1, monthlyRate: "3500.00" },
    });

    const tenant1 = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "One", status: "ACTIVE" } });
    const tenant2 = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "B", lastName: "Two", status: "ACTIVE" } });
    const tenant3 = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "C", lastName: "Three", status: "MOVED_OUT" } });

    // fullRoom: 2 ACTIVE tenancies against capacity 2 -> full
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant1.id, roomId: fullRoom.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant2.id, roomId: fullRoom.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });

    // partialRoom: 1 ACTIVE + 1 ENDED (should not count) against capacity 2 -> partial
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant3.id, roomId: partialRoom.id, startDate: new Date(), endDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ENDED" },
    });
    const activeTenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "D", lastName: "Four", status: "ACTIVE" } });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: activeTenant.id, roomId: partialRoom.id, startDate: new Date(), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });

    // vacantRoom: no tenancies at all

    const scoped = createScopedClient(org.id);
    const overview = await getBuildingOverview(scoped, building.id);

    expect(overview).not.toBeNull();
    expect(overview!.floors).toHaveLength(2);

    const floor1Result = overview!.floors.find((f) => f.label === "1F")!;
    const fullRoomResult = floor1Result.rooms.find((r) => r.name === "101")!;
    const partialRoomResult = floor1Result.rooms.find((r) => r.name === "102")!;
    expect(fullRoomResult.occupied).toBe(2);
    expect(fullRoomResult.capacity).toBe(2);
    expect(partialRoomResult.occupied).toBe(1);

    const floor2Result = overview!.floors.find((f) => f.label === "2F")!;
    const vacantRoomResult = floor2Result.rooms.find((r) => r.name === "201")!;
    expect(vacantRoomResult.occupied).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web test -- buildingOverview`
Expected: FAIL with `Cannot find module '../buildingOverview'`.

- [ ] **Step 3: Implement `getBuildingOverview`**

`apps/web/src/lib/buildingOverview.ts`:
```ts
import type { createScopedClient } from "@mytenants/db";

export type RoomOccupancy = {
  id: string;
  name: string;
  capacity: number;
  monthlyRate: string;
  occupied: number;
};

export type FloorOverview = {
  id: string;
  label: string;
  rooms: RoomOccupancy[];
};

export type BuildingOverview = {
  id: string;
  name: string;
  address: string | null;
  floors: FloorOverview[];
};

export async function getBuildingOverview(
  scoped: ReturnType<typeof createScopedClient>,
  buildingId: string
): Promise<BuildingOverview | null> {
  const building = await scoped.building.findFirst({
    where: { id: buildingId },
    include: {
      floors: {
        orderBy: { createdAt: "asc" },
        include: { rooms: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!building) return null;

  const roomIds = building.floors.flatMap((floor) => floor.rooms.map((room) => room.id));

  const occupancyCounts = roomIds.length
    ? await scoped.tenancy.groupBy({
        by: ["roomId"],
        where: { roomId: { in: roomIds }, status: "ACTIVE" },
        _count: { _all: true },
      })
    : [];
  const occupiedByRoomId = new Map(occupancyCounts.map((row) => [row.roomId, row._count._all]));

  return {
    id: building.id,
    name: building.name,
    address: building.address,
    floors: building.floors.map((floor) => ({
      id: floor.id,
      label: floor.label,
      rooms: floor.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        monthlyRate: room.monthlyRate.toString(),
        occupied: occupiedByRoomId.get(room.id) ?? 0,
      })),
    })),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web test -- buildingOverview`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/buildingOverview.ts apps/web/src/lib/__tests__/buildingOverview.test.ts
git commit -m "feat(web): add building occupancy computation from active tenancies"
```

---

## Task 5: Buildings UI and End-to-End Coverage

**Files:**
- Create: `apps/web/src/app/dashboard/buildings/page.tsx`
- Create: `apps/web/src/app/dashboard/buildings/CreateBuildingForm.tsx`
- Create: `apps/web/src/app/dashboard/buildings/[id]/page.tsx`
- Create: `apps/web/src/app/dashboard/buildings/[id]/AddFloorForm.tsx`
- Create: `apps/web/src/app/dashboard/buildings/[id]/AddRoomForm.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx` (add a nav link to `/dashboard/buildings`)
- Modify: `apps/web/src/app/dashboard/page.tsx` (link to `/dashboard/buildings`)
- Create: `apps/web/e2e/buildings.spec.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`, `createScopedClient` from `@mytenants/db`, `getBuildingOverview` from `@/lib/buildingOverview` (Task 4), and the API routes from Tasks 1-3.
- Produces: the `/dashboard/buildings` and `/dashboard/buildings/[id]` pages — the entry point later plans (tenant admission) will link into for room selection.

- [ ] **Step 1: Buildings list page and create form**

`apps/web/src/app/dashboard/buildings/CreateBuildingForm.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateBuildingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address }),
    });
    if (res.ok) {
      setName("");
      setAddress("");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create building");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-6">
      <div>
        <label className="block text-sm">
          Name
          <input
            className="border rounded px-2 py-1 block"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <label className="block text-sm">
          Address (optional)
          <input
            className="border rounded px-2 py-1 block"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
      </div>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-black text-white rounded px-3 py-1">
        Add Building
      </button>
    </form>
  );
}
```

**Note (label association):** every form in this task wraps its `<input>` inside its `<label>` (rather than sibling `<label>`/`<input>` with no `htmlFor`/`id` link) — this is required for `page.getByLabel(...)` to resolve the field in Step 4's E2E test, and is also the correct accessible pattern.

`apps/web/src/app/dashboard/buildings/page.tsx`:
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { CreateBuildingForm } from "./CreateBuildingForm";

export default async function BuildingsListPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const scoped = createScopedClient(session.user.organizationId);
  const buildings = await scoped.building.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Buildings</h1>
      <CreateBuildingForm />
      <ul className="space-y-2">
        {buildings.map((building) => (
          <li key={building.id}>
            <Link className="text-blue-700 underline" href={`/dashboard/buildings/${building.id}`}>
              {building.name}
            </Link>
          </li>
        ))}
        {buildings.length === 0 && <li className="text-gray-500">No buildings yet.</li>}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Building detail page with the floors → rooms occupancy grid**

`apps/web/src/app/dashboard/buildings/[id]/AddFloorForm.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddFloorForm({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/buildings/${buildingId}/floors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (res.ok) {
      setLabel("");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to add floor");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-4">
      <div>
        <label className="block text-sm">
          Floor label
          <input
            className="border rounded px-2 py-1 block"
            placeholder="e.g. 1F"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </label>
      </div>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-black text-white rounded px-3 py-1">
        Add Floor
      </button>
    </form>
  );
}
```

`apps/web/src/app/dashboard/buildings/[id]/AddRoomForm.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddRoomForm({ floorId }: { floorId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [monthlyRate, setMonthlyRate] = useState("0");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/floors/${floorId}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, capacity: Number(capacity), monthlyRate: Number(monthlyRate) }),
    });
    if (res.ok) {
      setName("");
      setCapacity("1");
      setMonthlyRate("0");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to add room");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-4">
      <div>
        <label className="block text-sm">
          Room name
          <input
            className="border rounded px-2 py-1 w-20 block"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <label className="block text-sm">
          Capacity
          <input
            className="border rounded px-2 py-1 w-16 block"
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <label className="block text-sm">
          Monthly rate
          <input
            className="border rounded px-2 py-1 w-24 block"
            type="number"
            min={0}
            value={monthlyRate}
            onChange={(e) => setMonthlyRate(e.target.value)}
            required
          />
        </label>
      </div>
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-black text-white rounded px-3 py-1">
        Add Room
      </button>
    </form>
  );
}
```

`apps/web/src/app/dashboard/buildings/[id]/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { getBuildingOverview } from "@/lib/buildingOverview";
import { AddFloorForm } from "./AddFloorForm";
import { AddRoomForm } from "./AddRoomForm";

function statusFor(occupied: number, capacity: number): "vacant" | "partial" | "full" {
  if (occupied === 0) return "vacant";
  if (occupied >= capacity) return "full";
  return "partial";
}

const STATUS_CLASSES: Record<string, string> = {
  vacant: "bg-gray-100",
  partial: "bg-yellow-100",
  full: "bg-red-100",
};

export default async function BuildingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const scoped = createScopedClient(session.user.organizationId);
  const building = await getBuildingOverview(scoped, id);

  if (!building) {
    return (
      <main className="p-6">
        <p>Building not found.</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">{building.name}</h1>
      {building.address && <p className="text-gray-500 mb-4">{building.address}</p>}

      <AddFloorForm buildingId={building.id} />

      <div className="space-y-6">
        {building.floors.map((floor) => (
          <section key={floor.id}>
            <h2 className="text-lg font-medium mb-2">{floor.label}</h2>
            <div className="flex gap-3 flex-wrap mb-2">
              {floor.rooms.map((room) => {
                const status = statusFor(room.occupied, room.capacity);
                return (
                  <div
                    key={room.id}
                    data-testid="room-card"
                    data-status={status}
                    className={`rounded-lg p-3 min-w-[7rem] border ${STATUS_CLASSES[status]}`}
                  >
                    <div className="font-semibold">{room.name}</div>
                    <div className="text-sm">
                      {room.occupied}/{room.capacity}
                    </div>
                  </div>
                );
              })}
              {floor.rooms.length === 0 && <p className="text-gray-500 text-sm">No rooms yet.</p>}
            </div>
            <AddRoomForm floorId={floor.id} />
          </section>
        ))}
        {building.floors.length === 0 && <p className="text-gray-500">No floors yet.</p>}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Wire the dashboard nav**

In `apps/web/src/app/dashboard/layout.tsx`, add a link to `/dashboard/buildings` in the existing `<header>` (next to the session user name), e.g. add `<Link href="/dashboard/buildings">Buildings</Link>` (import `Link` from `next/link`) — keep the existing session-check logic from the Foundation plan untouched.

In `apps/web/src/app/dashboard/page.tsx`, add a `<Link href="/dashboard/buildings">Manage buildings</Link>` alongside the existing placeholder text.

- [ ] **Step 4: Write the end-to-end test**

`apps/web/e2e/buildings.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("create a building, add a floor and a room, and see it vacant in the overview grid", async ({ page }) => {
  const email = `buildings-e2e-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByPlaceholder("Organization name").fill("Buildings E2E Org");
  await page.getByPlaceholder("Your name").fill("E2E Owner");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/buildings");
  await page.getByLabel("Name").fill("Sunrise Hall");
  await page.getByRole("button", { name: "Add Building" }).click();
  await expect(page.getByRole("link", { name: "Sunrise Hall" })).toBeVisible();

  await page.getByRole("link", { name: "Sunrise Hall" }).click();
  await expect(page.getByRole("heading", { name: "Sunrise Hall" })).toBeVisible();

  await page.getByLabel("Floor label").fill("1F");
  await page.getByRole("button", { name: "Add Floor" }).click();
  await expect(page.getByRole("heading", { name: "1F" })).toBeVisible();

  await page.getByLabel("Room name").fill("101");
  await page.getByLabel("Capacity").fill("2");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByRole("button", { name: "Add Room" }).click();

  const roomCard = page.getByTestId("room-card");
  await expect(roomCard).toBeVisible();
  await expect(roomCard).toHaveAttribute("data-status", "vacant");
  await expect(roomCard).toContainText("0/2");
});
```

- [ ] **Step 5: Run the full suite**

Run: `pnpm --filter web exec playwright install --with-deps chromium` (if not already installed)
Run: `pnpm --filter web test` — Expected: PASS (all unit tests).
Run: `pnpm --filter web test:e2e` — Expected: PASS (this new test plus the Foundation plan's existing `auth.spec.ts`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard apps/web/e2e/buildings.spec.ts
git commit -m "feat(web): add buildings UI with floors/rooms occupancy grid and e2e coverage"
```

---

## Plan Self-Review Notes

- **Spec coverage:** §6.5 (Building/Dorm Overview) is implemented end-to-end: setup (create building, add floors, add rooms) and the color-coded occupancy grid. §5's Building/Floor/Room/Tenancy models are exercised as designed (room-level capacity only, no bed/slot tracking — matches the non-goal).
- **Constraints followed:** every Floor/Room create validates its parent belongs to the caller's org (Tasks 2-3); no nested Prisma writes anywhere in this plan; every new API route starts with `requireOrgSession()`; `findFirst` used throughout, never `findUnique`.
- **Type consistency:** `BuildingOverview`/`FloorOverview`/`RoomOccupancy` types from Task 4 are the exact shape Task 5's UI destructures (`id`, `name`/`label`, `capacity`, `occupied`, `monthlyRate`, `address`). Route response shapes (`{ building }`, `{ floor }`, `{ room }`, `{ buildings }`) are consistent between the API tasks and the UI code that calls them.
- **Two defects caught and fixed during self-review before dispatch:** (1) the initial draft used sibling `<label>`/`<input>` pairs with no `htmlFor`/wrapping association, which would have made every `page.getByLabel(...)` call in the Task 5 E2E test fail to resolve — fixed by wrapping each input inside its label. (2) the initial draft used Next.js's pre-15 synchronous `{ params: { id: string } }` route/page signature; Next.js 15 (confirmed installed at 15.5.25 from the Foundation plan's build logs) makes dynamic-segment `params` a `Promise` — fixed every handler and the detail page to `params: Promise<{ id: string }>` + `await params`, and updated test call-sites to pass `Promise.resolve({ id })` so they type-check under strict mode.
