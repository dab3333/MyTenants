-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "emergencyContact",
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactRelationship" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT;
