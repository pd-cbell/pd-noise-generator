-- Add patch-safe taxonomy fields while retaining legacy vertical/maturityLevel
ALTER TABLE "GoldenDemo" ADD COLUMN "industry" TEXT;
ALTER TABLE "GoldenDemo" ADD COLUMN "useCase" TEXT;
