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

async function makeInvoice(organizationId: string, amountDue = "3000.00") {
  const building = await prisma.building.create({ data: { organizationId, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId, buildingId: building.id, label: "1F" } });
  const room = await prisma.room.create({ data: { organizationId, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" } });
  const tenant = await prisma.tenant.create({ data: { organizationId, firstName: "A", lastName: "Tenant", status: "ACTIVE" } });
  const tenancy = await prisma.tenancy.create({
    data: { organizationId, tenantId: tenant.id, roomId: room.id, startDate: new Date("2026-01-01"), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
  });
  return prisma.invoice.create({
    data: { organizationId, tenancyId: tenancy.id, periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), amountDue, dueDate: new Date("2099-01-01") },
  });
}

describe("PATCH /api/invoices/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("edits amountDue and recomputes status", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Invoice Edit" } });
    const invoice = await makeInvoice(org.id, "3000.00");
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: invoice.id, amountPaid: "3000.00", method: "CASH", recordedByUserId: (await prisma.user.create({ data: { organizationId: org.id, email: `u-${org.id}@example.com`, passwordHash: "x", name: "U" } })).id },
    });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ amountDue: 2000 }) }),
      { params: Promise.resolve({ id: invoice.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invoice.status).toBe("PAID");
  });

  it("ignores an attempt to set status directly", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Invoice Status Guard" } });
    const invoice = await makeInvoice(org.id);

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "PAID" }) }),
      { params: Promise.resolve({ id: invoice.id }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invoice.status).toBe("PENDING");
  });

  it("returns 404 for an invoice belonging to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Invoice Edit Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Invoice Edit Guard" } });
    const invoiceB = await makeInvoice(orgB.id);

    sessionFor(orgA.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ amountDue: 1 }) }),
      { params: Promise.resolve({ id: invoiceB.id }) }
    );

    expect(res.status).toBe(404);
  });

  it("returns 409 when the new periodStart collides with another invoice on the same tenancy", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Invoice Edit Duplicate Period" } });
    const invoice = await makeInvoice(org.id);
    await prisma.invoice.create({
      data: { organizationId: org.id, tenancyId: invoice.tenancyId, periodStart: new Date("2026-02-01"), periodEnd: new Date("2026-02-28"), amountDue: "3000.00", dueDate: new Date("2026-02-05") },
    });

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ periodStart: "2026-02-01" }) }),
      { params: Promise.resolve({ id: invoice.id }) }
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("An invoice already exists for this tenancy covering this period");
  });

  it("returns 400 for an invalid amountDue", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Invoice Edit Invalid" } });
    const invoice = await makeInvoice(org.id);

    sessionFor(org.id);
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ amountDue: -5 }) }),
      { params: Promise.resolve({ id: invoice.id }) }
    );

    expect(res.status).toBe(400);
  });
});
