import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { GET } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

describe("GET /api/notifications/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET(new Request("http://localhost/api/notifications/x"), { params: Promise.resolve({ id: "x" }) });
    expect(res.status).toBe(401);
  });

  it("returns a notification with its recipients for the caller's organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Notification Detail" } });
    const tenant = await prisma.tenant.create({
      data: { organizationId: org.id, firstName: "Jane", lastName: "Doe", status: "ACTIVE", email: "jane@example.com" },
    });
    const notification = await prisma.notification.create({
      data: { organizationId: org.id, subject: "Hi", body: "Hello", scope: "TENANT", trigger: "MANUAL" },
    });
    await prisma.notificationRecipient.create({
      data: {
        organizationId: org.id,
        notificationId: notification.id,
        tenantId: tenant.id,
        deliveryStatus: "SENT",
        recipientEmail: "jane@example.com",
      },
    });
    sessionFor(org.id);

    const res = await GET(new Request(`http://localhost/api/notifications/${notification.id}`), {
      params: Promise.resolve({ id: notification.id }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notification.subject).toBe("Hi");
    expect(data.notification.recipients).toHaveLength(1);
    expect(data.notification.recipients[0].tenant.firstName).toBe("Jane");
  });

  it("returns 404 when the notification belongs to another organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Org A Notification" } });
    const otherOrg = await prisma.organization.create({ data: { name: "Org B Notification" } });
    const notification = await prisma.notification.create({
      data: { organizationId: org.id, subject: "Hi", body: "Hello", scope: "ALL", trigger: "MANUAL" },
    });
    sessionFor(otherOrg.id);

    const res = await GET(new Request(`http://localhost/api/notifications/${notification.id}`), {
      params: Promise.resolve({ id: notification.id }),
    });

    expect(res.status).toBe(404);
  });
});
