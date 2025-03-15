/*
  Warnings:

  - Added the required column `platformFee` to the `creator_earnings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "creator_earnings" ADD COLUMN     "platformFee" DECIMAL(65,30) NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "earningsBalance" DECIMAL(65,30) NOT NULL DEFAULT 0.0;

-- Migrate existing earnings data to the new earningsBalance field
-- For each creator, sum up their existing earnings and update their earningsBalance
-- Note: This assumes that the existing amount in creator_earnings is the net amount after fees
-- If the existing amount is the gross amount, this would need to be adjusted
DO $$
DECLARE
    creator_id TEXT;
    total_earnings DECIMAL(65,30);
BEGIN
    -- Loop through all users who have earnings
    FOR creator_id, total_earnings IN
        SELECT "creatorId", SUM(amount) as total
        FROM "creator_earnings"
        GROUP BY "creatorId"
    LOOP
        -- Update the earningsBalance for this user
        UPDATE "users"
        SET "earningsBalance" = total_earnings
        WHERE id = creator_id;
    END LOOP;
END $$;
