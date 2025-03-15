// Script to fix user balances by properly separating payment balances from earning balances
const { PrismaClient } = require('@prisma/client');

async function fixBalances() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Starting balance fix operation...');
    
    // 1. First set platform fee for all existing earnings records
    console.log('Setting platform fee for existing earnings records...');
    await prisma.$executeRawUnsafe(`
      UPDATE "creator_earnings"
      SET "platformFee" = (amount * 15 / 85)
      WHERE "platformFee" = 0 OR "platformFee" IS NULL
    `);
    
    // 2. Update all users' earnings balances based on their creator earnings
    console.log('Updating earnings balances for all users...');
    await prisma.$executeRawUnsafe(`
      WITH creator_totals AS (
        SELECT "creatorId", SUM(amount) as total_earnings
        FROM "creator_earnings"
        GROUP BY "creatorId"
      )
      UPDATE "users" u
      SET "earningsBalance" = ct.total_earnings
      FROM creator_totals ct
      WHERE u.id = ct."creatorId"
    `);
    
    // 3. Verify the results - count users with updated earnings balances
    const updatedUsers = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM "users"
      WHERE "earningsBalance" > 0
    `);
    
    console.log(`Fixed earnings balances for ${updatedUsers[0].count} users`);
    
    // 4. Optional: Show users with non-zero earnings balances
    const usersWithEarnings = await prisma.$queryRawUnsafe(`
      SELECT id, username, balance, "earningsBalance"
      FROM "users"
      WHERE "earningsBalance" > 0
      ORDER BY "earningsBalance" DESC
    `);
    
    console.log('Users with earnings balances:');
    console.table(usersWithEarnings);
    
    console.log('Balance fix operation completed successfully.');
  } catch (error) {
    console.error('Error during balance fix operation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBalances()
  .then(() => console.log('Script execution completed.'))
  .catch(e => console.error('Script execution failed:', e)); 