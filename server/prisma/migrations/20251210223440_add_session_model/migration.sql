-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "goldenDemoId" TEXT NOT NULL,
    "name" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "metricsSnapshotJson" JSONB,
    "notes" TEXT,
    "createdByUserId" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_goldenDemoId_idx" ON "Session"("goldenDemoId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_goldenDemoId_fkey" FOREIGN KEY ("goldenDemoId") REFERENCES "GoldenDemo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
