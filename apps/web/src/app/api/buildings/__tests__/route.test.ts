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
