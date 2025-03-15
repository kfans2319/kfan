-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "idImageUrl" TEXT,
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "selfieImageUrl" TEXT,
ADD COLUMN     "verificationProcessedAt" TIMESTAMP(3),
ADD COLUMN     "verificationProcessedById" TEXT,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "verificationSubmittedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_verificationProcessedById_fkey" FOREIGN KEY ("verificationProcessedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
