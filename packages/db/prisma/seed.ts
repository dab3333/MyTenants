// Demo data for exercising the dashboard (and other UI) with realistic, varied
// state: buildings across the full occupancy spectrum, a rising income/tenant
// trend, and a couple of genuinely overdue invoices.
//
// Run against whichever database DATABASE_URL points to:
//   pnpm --filter db seed
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@mytenants.local";
const DEMO_PASSWORD = "Demo12345!";
const BILLING_DAY = 5;
const METHODS = ["CASH", "BANK_TRANSFER", "GCASH"] as const;

const now = new Date();
const CUR_Y = now.getUTCFullYear();
const CUR_M = now.getUTCMonth();

function monthDate(offsetMonthsAgo: number, day: number): Date {
  return new Date(Date.UTC(CUR_Y, CUR_M - offsetMonthsAgo, day));
}

function monthEnd(offsetMonthsAgo: number): Date {
  return new Date(Date.UTC(CUR_Y, CUR_M - offsetMonthsAgo + 1, 0));
}

let orgId: string;
let ownerId: string;

async function createInvoicesForTenancy({
  tenancyId,
  monthlyRate,
  startOffset,
  endOffset,
  skipPaymentOffsets = [],
}: {
  tenancyId: string;
  monthlyRate: number;
  startOffset: number;
  endOffset: number;
  skipPaymentOffsets?: number[];
}) {
  let methodIdx = 0;
  for (let offset = startOffset; offset >= endOffset; offset--) {
    const periodStart = monthDate(offset, 1);
    const periodEnd = monthEnd(offset);
    const dueDate = monthDate(offset, BILLING_DAY);
    const isPastDue = dueDate.getTime() < now.getTime();
    const skipPayment = skipPaymentOffsets.includes(offset);

    const status = skipPayment ? (isPastDue ? "OVERDUE" : "PENDING") : "PAID";

    const invoice = await prisma.invoice.create({
      data: { organizationId: orgId, tenancyId, periodStart, periodEnd, amountDue: monthlyRate, dueDate, status },
    });

    if (!skipPayment) {
      const paidAt = new Date(Math.min(dueDate.getTime() + 3 * 24 * 60 * 60 * 1000, now.getTime()));
      await prisma.payment.create({
        data: {
          organizationId: orgId,
          invoiceId: invoice.id,
          amountPaid: monthlyRate,
          method: METHODS[methodIdx % METHODS.length],
          paidAt,
          recordedByUserId: ownerId,
        },
      });
      methodIdx++;
    }
  }
}

async function main() {
  const existing = await prisma.user.findFirst({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log(`Demo user ${DEMO_EMAIL} already exists (org ${existing.organizationId}). Skipping — delete it first to reseed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const org = await prisma.organization.create({
    data: {
      name: "Demo Properties",
      users: { create: { name: "Demo Owner", email: DEMO_EMAIL, passwordHash, role: "OWNER" } },
    },
    include: { users: true },
  });
  orgId = org.id;
  ownerId = org.users[0].id;

  const makeBuilding = (name: string, address: string) => prisma.building.create({ data: { organizationId: orgId, name, address } });
  const makeFloor = (buildingId: string, label: string) => prisma.floor.create({ data: { organizationId: orgId, buildingId, label } });
  const makeRoom = (floorId: string, name: string, capacity: number, monthlyRate: number) =>
    prisma.room.create({ data: { organizationId: orgId, floorId, name, capacity, monthlyRate } });
  const makeTenant = (firstName: string, lastName: string, email: string, phone: string) =>
    prisma.tenant.create({ data: { organizationId: orgId, firstName, lastName, email, phone, status: "ACTIVE" } });
  const makeTenancy = (tenantId: string, roomId: string, monthlyRate: number, startOffset: number, endOffset: number | null) =>
    prisma.tenancy.create({
      data: {
        organizationId: orgId,
        tenantId,
        roomId,
        startDate: monthDate(startOffset, 1),
        endDate: endOffset !== null ? monthDate(endOffset, 15) : null,
        monthlyRate,
        depositAmount: monthlyRate,
        billingDay: BILLING_DAY,
        status: endOffset !== null ? "ENDED" : "ACTIVE",
      },
    });

  // --- Sunrise Residences: fully occupied ---
  const sunrise = await makeBuilding("Sunrise Residences", "12 Acacia St, Quezon City");
  const sunrise1F = await makeFloor(sunrise.id, "1F");
  const sunrise2F = await makeFloor(sunrise.id, "2F");
  const sr101 = await makeRoom(sunrise1F.id, "101", 2, 3500);
  const sr102 = await makeRoom(sunrise1F.id, "102", 1, 3000);
  const sr201 = await makeRoom(sunrise2F.id, "201", 2, 3500);

  const tAna = await makeTenant("Ana", "Reyes", "ana.reyes@example.com", "0917-100-0001");
  const tMiguelS = await makeTenant("Miguel", "Santos", "miguel.santos@example.com", "0917-100-0002");
  const tLiza = await makeTenant("Liza", "Cruz", "liza.cruz@example.com", "0917-100-0003");
  const tPaolo = await makeTenant("Paolo", "Garcia", "paolo.garcia@example.com", "0917-100-0004");
  const tCarmela = await makeTenant("Carmela", "Lim", "carmela.lim@example.com", "0917-100-0005");

  const tenAna = await makeTenancy(tAna.id, sr101.id, 3500, 5, null);
  await createInvoicesForTenancy({ tenancyId: tenAna.id, monthlyRate: 3500, startOffset: 5, endOffset: 0 });
  const tenMiguelS = await makeTenancy(tMiguelS.id, sr101.id, 3500, 5, null);
  await createInvoicesForTenancy({ tenancyId: tenMiguelS.id, monthlyRate: 3500, startOffset: 5, endOffset: 0 });
  const tenLiza = await makeTenancy(tLiza.id, sr102.id, 3000, 4, null);
  await createInvoicesForTenancy({ tenancyId: tenLiza.id, monthlyRate: 3000, startOffset: 4, endOffset: 0 });
  const tenPaolo = await makeTenancy(tPaolo.id, sr201.id, 3500, 2, null);
  await createInvoicesForTenancy({ tenancyId: tenPaolo.id, monthlyRate: 3500, startOffset: 2, endOffset: 0 });
  const tenCarmela = await makeTenancy(tCarmela.id, sr201.id, 3500, 0, null);
  // Just moved in this month — deliberately unpaid past due date (overdue example #1).
  await createInvoicesForTenancy({ tenancyId: tenCarmela.id, monthlyRate: 3500, startOffset: 0, endOffset: 0, skipPaymentOffsets: [0] });

  // --- Maple Court: half occupied ---
  const maple = await makeBuilding("Maple Court", "45 Ipil St, Mandaluyong");
  const maple1F = await makeFloor(maple.id, "1F");
  const mc101 = await makeRoom(maple1F.id, "101", 2, 3200);
  const mc102 = await makeRoom(maple1F.id, "102", 2, 3200);

  const tJosef = await makeTenant("Josef", "Tan", "josef.tan@example.com", "0917-100-0006");
  const tNadia = await makeTenant("Nadia", "Flores", "nadia.flores@example.com", "0917-100-0007");
  const tenJosef = await makeTenancy(tJosef.id, mc101.id, 3200, 5, null);
  await createInvoicesForTenancy({ tenancyId: tenJosef.id, monthlyRate: 3200, startOffset: 5, endOffset: 0 });
  const tenNadia = await makeTenancy(tNadia.id, mc102.id, 3200, 1, null);
  await createInvoicesForTenancy({ tenancyId: tenNadia.id, monthlyRate: 3200, startOffset: 1, endOffset: 0 });

  // --- Riverside Hall: vacant (recently vacated) ---
  const riverside = await makeBuilding("Riverside Hall", "8 Riverside Dr, Pasig");
  const riverside1F = await makeFloor(riverside.id, "1F");
  const rh101 = await makeRoom(riverside1F.id, "101", 2, 3000);
  await makeRoom(riverside1F.id, "102", 2, 3000);

  const tMiguelC = await makeTenant("Miguel", "Cruz", "miguel.cruz@example.com", "0917-100-0008");
  const tenMiguelC = await makeTenancy(tMiguelC.id, rh101.id, 3000, 7, 1);
  await createInvoicesForTenancy({ tenancyId: tenMiguelC.id, monthlyRate: 3000, startOffset: 7, endOffset: 1 });

  // --- Birchwood Annex: mostly full ---
  const birchwood = await makeBuilding("Birchwood Annex", "3 Birchwood Ave, Makati");
  const birchwood1F = await makeFloor(birchwood.id, "1F");
  const birchwood2F = await makeFloor(birchwood.id, "2F");
  const bw101 = await makeRoom(birchwood1F.id, "101", 2, 4000);
  const bw201 = await makeRoom(birchwood2F.id, "201", 2, 4000);

  const tRamon = await makeTenant("Ramon", "Dela Cruz", "ramon.delacruz@example.com", "0917-100-0009");
  const tBea = await makeTenant("Bea", "Villanueva", "bea.villanueva@example.com", "0917-100-0010");
  const tKen = await makeTenant("Ken", "Ocampo", "ken.ocampo@example.com", "0917-100-0011");
  const tenRamon = await makeTenancy(tRamon.id, bw101.id, 4000, 5, null);
  await createInvoicesForTenancy({ tenancyId: tenRamon.id, monthlyRate: 4000, startOffset: 5, endOffset: 0 });
  const tenBea = await makeTenancy(tBea.id, bw101.id, 4000, 3, null);
  await createInvoicesForTenancy({ tenancyId: tenBea.id, monthlyRate: 4000, startOffset: 3, endOffset: 0 });
  const tenKen = await makeTenancy(tKen.id, bw201.id, 4000, 0, null);
  // Just moved in this month — deliberately unpaid past due date (overdue example #2).
  await createInvoicesForTenancy({ tenancyId: tenKen.id, monthlyRate: 4000, startOffset: 0, endOffset: 0, skipPaymentOffsets: [0] });

  // A couple of unassigned prospects, for realism on the Tenants page.
  const sofia = await makeTenant("Sofia", "Ramirez", "sofia.ramirez@example.com", "0917-100-0012");
  await prisma.tenant.update({ where: { id: sofia.id }, data: { status: "PROSPECT" } });
  const diego = await makeTenant("Diego", "Aquino", "diego.aquino@example.com", "0917-100-0013");
  await prisma.tenant.update({ where: { id: diego.id }, data: { status: "PROSPECT" } });

  console.log("Seed complete.");
  console.log(`Log in at /login with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
