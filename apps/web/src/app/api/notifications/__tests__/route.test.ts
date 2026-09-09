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

async function makeOrgWithActiveTenant(email: string | null = "jane@example.com") {
  const org = await prisma.organization.create({ data: { name: `Org Notifications ${Math.random()}` } });
  const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
  const room = await prisma.room.create({
    data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
  });
  const tenant = await prisma.tenant.create({
    data: { organizationId: org.id, firstName: "Jane", lastName: "Doe", status: "ACTIVE", email },
  });
  const tenancy = await prisma.tenancy.create({
    data: {
      organizationId: org.id,
      tenantId: tenant.id,
      roomId: room.id,
      startDate: new Date("2026-01-01"),
      monthlyRate: "3000.00",
      depositAmount: "3000.00",
      status: "ACTIVE",
    },
  });
  return { org, building, room, tenant, tenancy };
}

describe("POST /api/notifications", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(new Request("http://localhost/api/notifications", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid scope", async () => {
    const { org } = await makeOrgWithActiveTenant();
    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({ scope: "NOT_A_SCOPE", subject: "Hi", body: "Hello" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when subject or body is missing", async () => {
    const { org } = await makeOrgWithActiveTenant();
    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost/api/notifications", { method: "POST", body: JSON.stringify({ scope: "ALL", subject: "" }) })
    );
    expect(res.status).toBe(400);
  });

  it("ALL scope reaches every tenant with a currently ACTIVE tenancy in the org", async () => {
    const { org, tenant } = await makeOrgWithActiveTenant();
    sessionFor(org.id);

    const res = await POST(
      new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({ scope: "ALL", subject: "Hi all", body: "Hello everyone" }),
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.recipients.total).toBe(1);
    expect(data.recipients.sent).toBe(1);
    const recipient = await prisma.notificationRecipient.findFirst({ where: { tenantId: tenant.id } });
    expect(recipient?.recipientEmail).toBe("jane@example.com");
    expect(recipient?.deliveryStatus).toBe("SENT");
  });

  it("BUILDING scope reaches only tenants with an active tenancy in that building", async () => {
    const { org, building } = await makeOrgWithActiveTenant();
    const otherBuilding = await prisma.building.create({ data: { organizationId: org.id, name: "Other Hall" } });
    sessionFor(org.id);

    const res = await POST(
      new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({ scope: "BUILDING", buildingId: building.id, subject: "Hi building", body: "Hello" }),
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.recipients.total).toBe(1);

    const resOther = await POST(
      new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({ scope: "BUILDING", buildingId: otherBuilding.id, subject: "Hi other", body: "Hello" }),
      })
    );
    const dataOther = await resOther.json();
    expect(dataOther.recipients.total).toBe(0);
  });

  it("ROOM scope reaches only tenants with an active tenancy in that room", async () => {
    const { org, room } = await makeOrgWithActiveTenant();
    const otherRoom = await prisma.room.create({
      data: { organizationId: org.id, floorId: room.floorId, name: "102", capacity: 1, monthlyRate: "3000.00" },
    });
    sessionFor(org.id);

    const res = await POST(
      new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({ scope: "ROOM", roomId: room.id, subject: "Hi room", body: "Hello" }),
      })
    );
    const data = await res.json();
    expect(data.recipients.total).toBe(1);

    const resOther = await POST(
      new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({ scope: "ROOM", roomId: otherRoom.id, subject: "Hi other room", body: "Hello" }),
      })
    );
    const dataOther = await resOther.json();
    expect(dataOther.recipients.total).toBe(0);
  });

  it("TENANT scope messages the given tenant directly regardless of status", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Prospect Message ${Math.random()}` } });
    const prospect = await prisma.tenant.create({
      data: { organizationId: org.id, firstName: "Prospect", lastName: "Pat", status: "PROSPECT", email: "pat@example.com" },
    });
    sessionFor(org.id);

    const res = await POST(
      new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({ scope: "TENANT", tenantId: prospect.id, subject: "Hi", body: "Hello" }),
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.recipients.total).toBe(1);
  });

  it("returns 404 when the scope-specific id belongs to another organization", async () => {
    const { building } = await makeOrgWithActiveTenant();
    const otherOrg = await prisma.organization.create({ data: { name: "Other Org" } });
    sessionFor(otherOrg.id);

    const res = await POST(
      new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({ scope: "BUILDING", buildingId: building.id, subject: "Hi", body: "Hello" }),
      })
    );

    expect(res.status).toBe(404);
  });

  it("records deliveryStatus FAILED with a reason for a tenant with no email on file", async () => {
    const { org, tenant } = await makeOrgWithActiveTenant(null);
    sessionFor(org.id);

    const res = await POST(
      new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({ scope: "ALL", subject: "Hi", body: "Hello" }),
      })
    );

    const data = await res.json();
    expect(data.recipients.failed).toBe(1);
    const recipient = await prisma.notificationRecipient.findFirst({ where: { tenantId: tenant.id } });
    expect(recipient?.deliveryStatus).toBe("FAILED");
    expect(recipient?.failureReason).toBe("No email on file");
    expect(recipient?.recipientEmail).toBeNull();
  });
});
