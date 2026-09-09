import { NextResponse } from "next/server";
import { createScopedClient, createEmailSender, type Tenant } from "@mytenants/db";
import { requireOrgSession } from "@/lib/requireOrgSession";

const NOTIFICATION_SCOPES = ["ALL", "BUILDING", "ROOM", "TENANT"] as const;
type NotificationScopeValue = (typeof NOTIFICATION_SCOPES)[number];

type ResolveRecipientsResult = { ok: true; tenants: Tenant[] } | { ok: false; notFound: string };

async function resolveRecipients(
  scoped: ReturnType<typeof createScopedClient>,
  scope: NotificationScopeValue,
  ids: { buildingId?: string; roomId?: string; tenantId?: string }
): Promise<ResolveRecipientsResult> {
  if (scope === "TENANT") {
    const tenant = await scoped.tenant.findFirst({ where: { id: ids.tenantId } });
    if (!tenant) return { ok: false, notFound: "Tenant not found" };
    return { ok: true, tenants: [tenant] };
  }
  if (scope === "BUILDING") {
    const building = await scoped.building.findFirst({ where: { id: ids.buildingId } });
    if (!building) return { ok: false, notFound: "Building not found" };
  }
  if (scope === "ROOM") {
    const room = await scoped.room.findFirst({ where: { id: ids.roomId } });
    if (!room) return { ok: false, notFound: "Room not found" };
  }

  const roomFilter =
    scope === "ROOM"
      ? { roomId: ids.roomId }
      : scope === "BUILDING"
        ? { room: { floor: { buildingId: ids.buildingId } } }
        : {};

  const tenants = await scoped.tenant.findMany({
    where: { tenancies: { some: { status: "ACTIVE", ...roomFilter } } },
  });
  return { ok: true, tenants };
}

export async function POST(request: Request) {
  const session = await requireOrgSession();
  if (!session.ok) return session.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { scope, buildingId, roomId, tenantId, subject, body: messageBody } = body as Record<string, unknown>;

  if (typeof scope !== "string" || !NOTIFICATION_SCOPES.includes(scope as NotificationScopeValue)) {
    return NextResponse.json({ error: "scope must be one of ALL, BUILDING, ROOM, TENANT" }, { status: 400 });
  }
  if (scope === "BUILDING" && typeof buildingId !== "string") {
    return NextResponse.json({ error: "buildingId is required for BUILDING scope" }, { status: 400 });
  }
  if (scope === "ROOM" && typeof roomId !== "string") {
    return NextResponse.json({ error: "roomId is required for ROOM scope" }, { status: 400 });
  }
  if (scope === "TENANT" && typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId is required for TENANT scope" }, { status: 400 });
  }
  if (typeof subject !== "string" || subject.trim() === "") {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }
  if (typeof messageBody !== "string" || messageBody.trim() === "") {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const scoped = createScopedClient(session.organizationId);
  const resolved = await resolveRecipients(scoped, scope as NotificationScopeValue, {
    buildingId: buildingId as string | undefined,
    roomId: roomId as string | undefined,
    tenantId: tenantId as string | undefined,
  });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.notFound }, { status: 404 });
  }

  const sendEmail = createEmailSender();
  const recipientResults = await Promise.all(
    resolved.tenants.map(async (tenant) => {
      if (!tenant.email) {
        return {
          tenantId: tenant.id,
          recipientEmail: null as string | null,
          deliveryStatus: "FAILED" as const,
          failureReason: "No email on file" as string | null,
        };
      }
      const result = await sendEmail({ to: tenant.email, subject, body: messageBody });
      return {
        tenantId: tenant.id,
        recipientEmail: tenant.email as string | null,
        deliveryStatus: (result.ok ? "SENT" : "FAILED") as "SENT" | "FAILED",
        failureReason: (result.ok ? null : result.error) as string | null,
      };
    })
  );

  const notification = await scoped.$transaction(async (tx) => {
    const created = await tx.notification.create({
      data: {
        organizationId: session.organizationId,
        subject,
        body: messageBody,
        scope: scope as NotificationScopeValue,
        trigger: "MANUAL",
      },
    });
    for (const recipient of recipientResults) {
      await tx.notificationRecipient.create({
        data: {
          organizationId: session.organizationId,
          notificationId: created.id,
          tenantId: recipient.tenantId,
          deliveryStatus: recipient.deliveryStatus,
          recipientEmail: recipient.recipientEmail,
          failureReason: recipient.failureReason,
        },
      });
    }
    return created;
  });

  return NextResponse.json(
    {
      notification,
      recipients: {
        total: recipientResults.length,
        sent: recipientResults.filter((r) => r.deliveryStatus === "SENT").length,
        failed: recipientResults.filter((r) => r.deliveryStatus === "FAILED").length,
      },
    },
    { status: 201 }
  );
}
