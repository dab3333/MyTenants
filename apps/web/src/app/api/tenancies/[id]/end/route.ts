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
