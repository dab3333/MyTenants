import { NextResponse } from "next/server";
import { createScopedClient, Prisma } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;
  const { id: tenancyId } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { periodStart, periodEnd, amountDue, dueDate } = body as Record<string, unknown>;

  if (typeof periodStart !== "string" || Number.isNaN(Date.parse(periodStart))) {
    return NextResponse.json({ error: "periodStart must be a valid date" }, { status: 400 });
  }
  if (typeof periodEnd !== "string" || Number.isNaN(Date.parse(periodEnd))) {
    return NextResponse.json({ error: "periodEnd must be a valid date" }, { status: 400 });
  }
  if (typeof amountDue !== "number" || !Number.isFinite(amountDue) || amountDue < 0) {
    return NextResponse.json({ error: "amountDue must be a non-negative number" }, { status: 400 });
  }
  if (typeof dueDate !== "string" || Number.isNaN(Date.parse(dueDate))) {
    return NextResponse.json({ error: "dueDate must be a valid date" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const tenancy = await scoped.tenancy.findFirst({ where: { id: tenancyId } });
  if (!tenancy) return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });

  try {
    const invoice = await scoped.invoice.create({
      data: {
        organizationId: session.organizationId,
        tenancyId: tenancy.id,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        amountDue,
        dueDate: new Date(dueDate),
        status: "PENDING",
      },
    });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "An invoice already exists for this tenancy covering this period" },
        { status: 409 }
      );
    }
    throw error;
  }
}
