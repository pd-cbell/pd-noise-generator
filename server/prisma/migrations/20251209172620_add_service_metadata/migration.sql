-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "changeIntegrationKey" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'technical';
