import { Prisma, PrismaClient } from "@mytenants/db";
import type { SendEmail } from "@mytenants/db";

export type RunOverdueRemindersResult = {
  sent: number;
  skippedNoEmail: number;
  skippedRecentlyReminded: number;
};

const REMINDER_COOLDOWN_DAYS = 7;

type OverdueInvoice = Prisma.InvoiceGetPayload<{
  include: { tenancy: { include: { tenant: true } } };
}>;

function groupByTenant(invoices: OverdueInvoice[]): Map<string, OverdueInvoice[]> {
  const groups = new Map<string, OverdueInvoice[]>();
  for (const invoice of invoices) {
    const tenantId = invoice.tenancy.tenant.id;
    const existing = groups.get(tenantId);
    if (existing) {
      existing.push(invoice);
    } else {
      groups.set(tenantId, [invoice]);
    }
  }
  return groups;
}

function buildReminderBody(invoices: OverdueInvoice[]): string {
  const lines = invoices.map(
    (invoice) =>
      `- Period ${invoice.periodStart.toISOString().slice(0, 10)} to ${invoice.periodEnd.toISOString().slice(0, 10)}: ${invoice.amountDue.toString()} due ${invoice.dueDate.toISOString().slice(0, 10)}`
  );
  return `You have ${invoices.length} overdue invoice(s):\n${lines.join("\n")}`;
}

export async function runOverdueReminders(
  prisma: PrismaClient,
  sendEmail: SendEmail,
  today: Date
): Promise<RunOverdueRemindersResult> {
  let sent = 0;
  let skippedNoEmail = 0;
  let skippedRecentlyReminded = 0;

  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: "OVERDUE" },
    include: { tenancy: { include: { tenant: true } } },
  });

  const cooldownStart = new Date(today);
  cooldownStart.setUTCDate(cooldownStart.getUTCDate() - REMINDER_COOLDOWN_DAYS);

  for (const [tenantId, invoices] of groupByTenant(overdueInvoices)) {
    const tenant = invoices[0].tenancy.tenant;
    const organizationId = invoices[0].organizationId;

    const recentReminder = await prisma.notificationRecipient.findFirst({
      where: { tenantId, notification: { trigger: "AUTO_REMINDER" } },
      orderBy: { notification: { sentAt: "desc" } },
      include: { notification: true },
    });

    if (recentReminder && recentReminder.notification.sentAt.getTime() >= cooldownStart.getTime()) {
      skippedRecentlyReminded++;
      continue;
    }

    const subject = "Overdue Payment Reminder";
    const body = buildReminderBody(invoices);

    if (!tenant.email) {
      await prisma.$transaction(async (tx) => {
        const notification = await tx.notification.create({
          data: { organizationId, subject, body, scope: "TENANT", trigger: "AUTO_REMINDER", sentAt: today },
        });
        await tx.notificationRecipient.create({
          data: {
            organizationId,
            notificationId: notification.id,
            tenantId,
            deliveryStatus: "FAILED",
            recipientEmail: null,
            failureReason: "No email on file",
          },
        });
      });
      skippedNoEmail++;
      continue;
    }

    const result = await sendEmail({ to: tenant.email, subject, body });
    await prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: { organizationId, subject, body, scope: "TENANT", trigger: "AUTO_REMINDER", sentAt: today },
      });
      await tx.notificationRecipient.create({
        data: {
          organizationId,
          notificationId: notification.id,
          tenantId,
          deliveryStatus: result.ok ? "SENT" : "FAILED",
          recipientEmail: tenant.email,
          failureReason: result.ok ? null : result.error,
        },
      });
    });
    sent++;
  }

  return { sent, skippedNoEmail, skippedRecentlyReminded };
}
