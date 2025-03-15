-- Migrate existing earnings data to the new earningsBalance field
-- For each creator, sum up their existing earnings and update their earningsBalance

-- First, check if we already have earnings data
SELECT COUNT(*) FROM "creator_earnings";

-- Set platform fee for existing records
-- Assumes the existing amount is already the net amount (85% of gross)
-- We're calculating the platform fee as 15/85 of the net amount to get the correct fee value
UPDATE "creator_earnings"
SET "platformFee" = (amount * 15 / 85)
WHERE "platformFee" = 0 OR "platformFee" IS NULL;

-- Then, migrate the data to earningsBalance
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
        
        -- Log the update (will be visible in the psql output)
        RAISE NOTICE 'Updated creator % with earnings balance of %', creator_id, total_earnings;
    END LOOP;
END $$;

-- Verify the results - show all users with non-zero earningsBalance
SELECT id, username, balance, "earningsBalance" 
FROM "users" 
WHERE "earningsBalance" > 0;

-- Also check all CreatorEarning records with their platformFee
SELECT 
    ce.id, 
    ce."creatorId",
    u.username as "creatorUsername",
    ce.amount as "netAmount",
    ce."platformFee",
    (ce.amount + ce."platformFee") as "grossAmount"
FROM "creator_earnings" ce
JOIN "users" u ON ce."creatorId" = u.id
ORDER BY ce."earnedAt" DESC; 