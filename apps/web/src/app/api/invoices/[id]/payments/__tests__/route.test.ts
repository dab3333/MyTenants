import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@mytenants/db";
import { POST } from "../route";

function sessionFor(organizationId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { organizationId, id: "user-1", role: "OWNER" },
  } as never);
}

// `Payment.recordedByUserId` is a real foreign key to `User.id`. The mocked
// session above always reports the session user's id as the literal string
// "user-1", so a real `User` row with that id must exist for the route's
// `payment.create` to satisfy the FK constraint (any organization works —
// the FK only checks that the row exists, not that its org matches).
async function ensureUserOneExists() {
  const existing = await prisma.user.findFirst({ where: { id: "user-1" } });
  if (existing) return;
  const org = await prisma.organization.create({ data: { name: "User Fixture Org" } });
  await prisma.user.create({
    data: { id: "user-1", organizationId: org.id, email: "user-1-fixture@example.com", passwordHash: "x", name: "Fixture User" },
  });
}

async function makeInvoice(organizationId: string) {
  const building = await prisma.building.create({ data: { organizationId, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId, buildingId: building.id, label: "1F" } });
  const room = await prisma.room.create({ data: { organizationId, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" } });
  const tenant = await prisma.tenant.create({ data: { organizationId, firstName: "A", lastName: "Tenant", status: "ACTIVE" } });
  const tenancy = await prisma.tenancy.create({
    data: { organizationId, tenantId: tenant.id, roomId: room.id, startDate: new Date("2026-01-01"), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
  });
  return prisma.invoice.create({
    data: { organizationId, tenancyId: tenancy.id, periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), amountDue: "3000.00", dueDate: new Date("2099-01-01") },
  });
}

describe("POST /api/invoices/[id]/payments", () => {
  beforeAll(async () => {
    await ensureUserOneExists();
  });

  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("records a partial payment and sets status to PARTIAL", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Partial Payment" } });
    const invoice = await makeInvoice(org.id);

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ amountPaid: 1000, method: "CASH" }) }),
      { params: Promise.resolve({ id: invoice.id }) }
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.payment.amountPaid).toBe("1000");
    expect(data.payment.recordedByUserId).toBe("user-1");
    expect(data.invoice.status).toBe("PARTIAL");
  });

  it("records a full payment and sets status to PAID", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Full Payment" } });
    const invoice = await makeInvoice(org.id);

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ amountPaid: 3000, method: "GCASH" }) }),
      { params: Promise.resolve({ id: invoice.id }) }
    );

    const data = await res.json();
    expect(data.invoice.status).toBe("PAID");
  });

  it("rejects a payment that would exceed the remaining balance", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Overpayment" } });
    const invoice = await makeInvoice(org.id);

    sessionFor(org.id);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ amountPaid: 3000.01, method: "CASH" }) }),
      { params: Promise.resolve({ id: invoice.id }) }
    );

    expect(res.status).toBe(409);
    const paymentCount = await prisma.payment.count({ where: { invoiceId: invoice.id } });
    expect(paymentCount).toBe(0);
  });

  it("rejects an overpayment across two payments combined", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Combined Overpayment" } });
    const invoice = await makeInvoice(org.id);
    sessionFor(org.id);
    await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ amountPaid: 2000, method: "CASH" }) }),
      { params: Promise.resolve({ id: invoice.id }) }
    );

    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ amountPaid: 1000.01, method: "CASH" }) }),
      { params: Promise.resolve({ id: invoice.id }) }
    );

    expect(res.status).toBe(409);
  });

  it("returns 404 for an invoice belonging to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Payment Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Payment Guard" } });
    const invoiceB = await makeInvoice(orgB.id);

    sessionFor(orgA.id);
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ amountPaid: 100, method: "CASH" }) }),
      { params: Promise.resolve({ id: invoiceB.id }) }
    );

    expect(res.status).toBe(404);
  });

  it.each([
    [{ method: "CASH" }, "amountPaid must be a positive number"],
    [{ amountPaid: 0, method: "CASH" }, "amountPaid must be a positive number"],
    [{ amountPaid: 100 }, "method must be one of CASH, BANK_TRANSFER, GCASH, OTHER"],
    [{ amountPaid: 100, method: "BITCOIN" }, "method must be one of CASH, BANK_TRANSFER, GCASH, OTHER"],
  ])("returns 400 for invalid body %j", async (body, expectedError) => {
    const org = await prisma.organization.create({ data: { name: `Org Payment Invalid ${JSON.stringify(body)}` } });
    const invoice = await makeInvoice(org.id);

    sessionFor(org.id);
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }), {
      params: Promise.resolve({ id: invoice.id }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe(expectedError);
  });
});
