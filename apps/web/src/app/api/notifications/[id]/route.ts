import { NextResponse } from "next/server";
import { createScopedClient } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;
  const { id } = await params;

  const scoped = createScopedClient(session.organizationId);
  const notification = await scoped.notification.findFirst({
    where: { id },
    include: { recipients: { include: { tenant: true } } },
  });
  if (!notification) return NextResponse.json({ error: "Notification not found" }, { status: 404 });

  return NextResponse.json({ notification });
}
