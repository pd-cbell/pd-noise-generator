-- DropForeignKey
ALTER TABLE "MappingProfile" DROP CONSTRAINT "MappingProfile_userId_fkey";

-- AddForeignKey
ALTER TABLE "MappingProfile" ADD CONSTRAINT "MappingProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
