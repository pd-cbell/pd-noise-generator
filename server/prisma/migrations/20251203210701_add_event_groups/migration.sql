-- CreateTable
CREATE TABLE "EventGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventGroupItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "client" TEXT NOT NULL,
    "delaySeconds" INTEGER NOT NULL,
    "severity" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "EventGroupItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EventGroupItem" ADD CONSTRAINT "EventGroupItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EventGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
