-- CreateTable
CREATE TABLE "GoldenDemo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "maturityLevel" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "personaNotes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoldenDemo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoldenDemo_name_createdByUserId_key" ON "GoldenDemo"("name", "createdByUserId");

-- AddForeignKey
ALTER TABLE "GoldenDemo" ADD CONSTRAINT "GoldenDemo_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
