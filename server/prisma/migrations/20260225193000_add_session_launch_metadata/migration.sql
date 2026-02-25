-- Add session source and launch metadata for Director/Webhook Golden Demo runs
CREATE TYPE "SessionSource" AS ENUM ('PRESENTER', 'DIRECTOR', 'WEBHOOK');

ALTER TABLE "Session"
ADD COLUMN "source" "SessionSource" NOT NULL DEFAULT 'PRESENTER',
ADD COLUMN "trackRunId" TEXT,
ADD COLUMN "mappingProfileId" TEXT,
ADD COLUMN "mappingProfileName" TEXT,
ADD COLUMN "launchedByUserId" TEXT,
ADD COLUMN "launchedByName" TEXT,
ADD COLUMN "launchedByEmail" TEXT;

CREATE UNIQUE INDEX "Session_trackRunId_key" ON "Session"("trackRunId");
