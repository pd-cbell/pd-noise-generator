-- CreateTable
CREATE TABLE "MappingProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "globalIncidentRoutingKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MappingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceMapping" (
    "id" TEXT NOT NULL,
    "mappingProfileId" TEXT NOT NULL,
    "logicalServiceName" TEXT NOT NULL,
    "incidentServiceId" TEXT,
    "incidentServiceName" TEXT,
    "incidentRoutingKeyOverride" TEXT,
    "changeServiceId" TEXT,
    "changeServiceName" TEXT,
    "useIncidentForChange" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceMapping_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServiceMapping" ADD CONSTRAINT "ServiceMapping_mappingProfileId_fkey" FOREIGN KEY ("mappingProfileId") REFERENCES "MappingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
