-- AlterTable
ALTER TABLE "Tenancy" ADD COLUMN "billingDay" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenancyId_periodStart_key" ON "Invoice"("tenancyId", "periodStart");
