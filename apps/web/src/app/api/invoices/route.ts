import { NextResponse } from "next/server";
import { createScopedClient, Prisma } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

const INVOICE_STATUSES = ["PENDING", "PARTIAL", "PAID", "OVERDUE"] as const;
type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number];

export async function GET(request: Request) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const tenancyId = searchParams.get("tenancyId");

  if (statusParam && !INVOICE_STATUSES.includes(statusParam as InvoiceStatusValue)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);

  if (tenancyId) {
    const tenancy = await scoped.tenancy.findFirst({ where: { id: tenancyId } });
    if (!tenancy) return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });
  }

  const where: Prisma.InvoiceWhereInput = {
    ...(statusParam ? { status: statusParam as InvoiceStatusValue } : {}),
    ...(tenancyId ? { tenancyId } : {}),
  };

  const invoices = await scoped.invoice.findMany({
    where,
    orderBy: { dueDate: "asc" },
    include: {
      payments: true,
      tenancy: { include: { tenant: true, room: { include: { floor: { include: { building: true } } } } } },
    },
  });

  return NextResponse.json({ invoices });
}
