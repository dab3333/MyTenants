import { describe, it, expect, afterAll, vi } from "vitest";
import { prisma } from "@mytenants/db";
import type { SendEmail } from "@mytenants/db";
import { runOverdueReminders } from "../reminders";

async function makeOverdueInvoice(options: { email?: string | null } = {}) {
  const org = await prisma.organization.create({ data: { name: `Org Reminders ${Math.random()}` } });
  const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
  const room = await prisma.room.create({
    data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
  });
  const tenant = await prisma.tenant.create({
    data: {
      organizationId: org.id,
      firstName: "A",
      lastName: "Tenant",
      status: "ACTIVE",
      email: options.email === undefined ? "a.tenant@example.com" : options.email,
    },
  });
  const tenancy = await prisma.tenancy.create({
    data: {
      organizationId: org.id,
      tenantId: tenant.id,
      roomId: room.id,
      startDate: new Date("2026-01-01"),
      monthlyRate: "3000.00",
      depositAmount: "3000.00",
      status: "ACTIVE",
    },
  });
  const invoice = await prisma.invoice.create({
    data: {
      organizationId: org.id,
      tenancyId: tenancy.id,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-01-31"),
      amountDue: "3000.00",
      dueDate: new Date("2026-01-01"),
      status: "OVERDUE",
    },
  });
  return { org, tenant, tenancy, invoice };
}

function fakeSendEmail(): { sendEmail: SendEmail; calls: { to: string; subject: string; body: string }[] } {
  const calls: { to: string; subject: string; body: string }[] = [];
  const sendEmail: SendEmail = vi.fn(async (input) => {
    calls.push(input);
    return { ok: true };
  });
  return { sendEmail, calls };
}

describe("runOverdueReminders", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("sends one reminder per tenant with an overdue invoice", async () => {
    const { tenant } = await makeOverdueInvoice();
    const { sendEmail, calls } = fakeSendEmail();

    const result = await runOverdueReminders(prisma, sendEmail, new Date("2026-02-01"));

    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(calls.some((call) => call.to === tenant.email)).toBe(true);
    const recipient = await prisma.notificationRecipient.findFirst({
      where: { tenantId: tenant.id },
      include: { notification: true },
    });
    expect(recipient?.deliveryStatus).toBe("SENT");
    expect(recipient?.recipientEmail).toBe(tenant.email);
    expect(recipient?.notification.trigger).toBe("AUTO_REMINDER");
    expect(recipient?.notification.scope).toBe("TENANT");
  });

  it("combines multiple overdue invoices for the same tenant into one reminder", async () => {
    const { tenant, tenancy, org } = await makeOverdueInvoice();
    await prisma.invoice.create({
      data: {
        organizationId: org.id,
        tenancyId: tenancy.id,
        periodStart: new Date("2026-02-01"),
        periodEnd: new Date("2026-02-28"),
        amountDue: "3000.00",
        dueDate: new Date("2026-02-01"),
        status: "OVERDUE",
      },
    });
    const { sendEmail, calls } = fakeSendEmail();

    await runOverdueReminders(prisma, sendEmail, new Date("2026-03-01"));

    const tenantCalls = calls.filter((call) => call.to === tenant.email);
    expect(tenantCalls).toHaveLength(1);
    expect(tenantCalls[0].body).toContain("2 overdue invoice");
    const recipients = await prisma.notificationRecipient.findMany({ where: { tenantId: tenant.id } });
    expect(recipients).toHaveLength(1);
  });

  it("skips a tenant reminded within the last 7 days", async () => {
    const { tenant } = await makeOverdueInvoice();
    const { sendEmail } = fakeSendEmail();
    await runOverdueReminders(prisma, sendEmail, new Date("2026-02-01"));

    const { sendEmail: secondSendEmail, calls: secondCalls } = fakeSendEmail();
    const result = await runOverdueReminders(prisma, secondSendEmail, new Date("2026-02-04"));

    expect(secondCalls.some((call) => call.to === tenant.email)).toBe(false);
    expect(result.skippedRecentlyReminded).toBeGreaterThanOrEqual(1);
  });

  it("sends a new reminder to a tenant last reminded 8+ days ago", async () => {
    const { tenant } = await makeOverdueInvoice();
    const { sendEmail } = fakeSendEmail();
    await runOverdueReminders(prisma, sendEmail, new Date("2026-02-01"));

    const { sendEmail: secondSendEmail, calls: secondCalls } = fakeSendEmail();
    const result = await runOverdueReminders(prisma, secondSendEmail, new Date("2026-02-09"));

    expect(secondCalls.some((call) => call.to === tenant.email)).toBe(true);
    expect(result.sent).toBeGreaterThanOrEqual(1);
  });

  it("skips and logs FAILED for a tenant with no email on file, without calling sendEmail", async () => {
    const { tenant } = await makeOverdueInvoice({ email: null });
    const { sendEmail, calls } = fakeSendEmail();

    const result = await runOverdueReminders(prisma, sendEmail, new Date("2026-02-01"));

    expect(calls).toHaveLength(0);
    expect(result.skippedNoEmail).toBeGreaterThanOrEqual(1);
    const recipient = await prisma.notificationRecipient.findFirst({ where: { tenantId: tenant.id } });
    expect(recipient?.deliveryStatus).toBe("FAILED");
    expect(recipient?.recipientEmail).toBeNull();
    expect(recipient?.failureReason).toBe("No email on file");
  });

  it("does not remind a tenant with no overdue invoices", async () => {
    const org = await prisma.organization.create({ data: { name: `Org No Overdue ${Math.random()}` } });
    const tenant = await prisma.tenant.create({
      data: { organizationId: org.id, firstName: "B", lastName: "Tenant", status: "ACTIVE", email: "b.tenant@example.com" },
    });
    const { sendEmail, calls } = fakeSendEmail();

    await runOverdueReminders(prisma, sendEmail, new Date("2026-02-01"));

    expect(calls.some((call) => call.to === tenant.email)).toBe(false);
  });
});
