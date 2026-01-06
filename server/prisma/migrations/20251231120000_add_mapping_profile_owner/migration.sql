ALTER TABLE "MappingProfile" ADD COLUMN "userId" TEXT;

ALTER TABLE "MappingProfile" ADD CONSTRAINT "MappingProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
