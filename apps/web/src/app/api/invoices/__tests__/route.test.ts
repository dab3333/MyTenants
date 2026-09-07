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

async function makeInvoice(organizationId: string, status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" = "PENDING") {
  const building = await prisma.building.create({ data: { organizationId, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId, buildingId: building.id, label: "1F" } });
  const room = await prisma.room.create({ data: { organizationId, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" } });
  const tenant = await prisma.tenant.create({ data: { organizationId, firstName: "A", lastName: "Tenant", status: "ACTIVE" } });
  const tenancy = await prisma.tenancy.create({
    data: { organizationId, tenantId: tenant.id, roomId: room.id, startDate: new Date("2026-01-01"), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
  });
  return prisma.invoice.create({
    data: { organizationId, tenancyId: tenancy.id, periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), amountDue: "3000.00", dueDate: new Date("2026-01-05"), status },
  });
}

describe("GET /api/invoices", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/invoices"));
    expect(res.status).toBe(401);
  });

  it("only lists invoices for the caller's organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Invoices" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Invoices" } });
    await makeInvoice(orgA.id);
    await makeInvoice(orgB.id);

    sessionFor(orgA.id);
    const res = await GET(new Request("http://localhost/api/invoices"));
    const data = await res.json();
    expect(data.invoices).toHaveLength(1);
  });

  it("filters by status", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Invoice Status Filter" } });
    await makeInvoice(org.id, "PENDING");
    await makeInvoice(org.id, "OVERDUE");

    sessionFor(org.id);
    const res = await GET(new Request("http://localhost/api/invoices?status=OVERDUE"));
    const data = await res.json();
    expect(data.invoices).toHaveLength(1);
    expect(data.invoices[0].status).toBe("OVERDUE");
  });

  it("rejects an invalid status filter with 400", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Invoice Invalid Status" } });
    sessionFor(org.id);

    const res = await GET(new Request("http://localhost/api/invoices?status=NOT_A_STATUS"));
    expect(res.status).toBe(400);
  });

  it("filters by tenancyId", async () => {
    const org = await prisma.organization.create({ data: { name: "Org Invoice Tenancy Filter" } });
    const invoiceA = await makeInvoice(org.id);
    await makeInvoice(org.id);

    sessionFor(org.id);
    const res = await GET(new Request(`http://localhost/api/invoices?tenancyId=${invoiceA.tenancyId}`));
    const data = await res.json();
    expect(data.invoices).toHaveLength(1);
    expect(data.invoices[0].id).toBe(invoiceA.id);
  });

  it("returns 404 when tenancyId belongs to another organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "Org A Tenancy Filter Guard" } });
    const orgB = await prisma.organization.create({ data: { name: "Org B Tenancy Filter Guard" } });
    const invoiceB = await makeInvoice(orgB.id);

    sessionFor(orgA.id);
    const res = await GET(new Request(`http://localhost/api/invoices?tenancyId=${invoiceB.tenancyId}`));
    expect(res.status).toBe(404);
  });
});
