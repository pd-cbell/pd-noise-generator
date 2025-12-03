-- CreateTable
CREATE TABLE "IncidentTemplate" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentTemplate_pkey" PRIMARY KEY ("id")
);
