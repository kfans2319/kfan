-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BANK', 'ETH_WALLET');

-- AlterTable - Make sure we update existing records
UPDATE "payout_requests" SET "payoutMethod" = 'BANK' WHERE "payoutMethod" IS NULL;

-- AlterTable
ALTER TABLE "payout_requests" ADD COLUMN "payoutMethod" "PayoutMethod" NOT NULL DEFAULT 'BANK';
ALTER TABLE "payout_requests" ADD COLUMN "ethWalletAddress" TEXT; 