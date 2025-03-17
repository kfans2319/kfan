import { PrismaClient } from '@prisma/client';

async function migrateEarningsBalance() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Starting migration of earnings data to earningsBalance...');
    
    // Only look for earnings with platformFee = 0, since null/undefined isn't supported
    // in the latest version of Prisma
    const existingEarnings = await prisma.creatorEarning.findMany({
      where: {
        platformFee: { equals: 0 }
      }
    });
    
    console.log(`Found ${existingEarnings.length} creator earnings records that need platformFee update.`);
    
    for (const earning of existingEarnings) {
      const netAmount = Number(earning.amount);
      // Calculate platform fee as 15/85 of the net amount to get the correct fee value
      const platformFee = (netAmount * 15) / 85;
      
      await prisma.creatorEarning.update({
        where: { id: earning.id },
        data: { platformFee }
      });
      
      console.log(`Updated earning ${earning.id} with platform fee of ${platformFee}`);
    }
    
    // Get all creators who have earnings
    const creators = await prisma.creatorEarning.groupBy({
      by: ['creatorId'],
      _sum: {
        amount: true,
      },
    });
    
    console.log(`Found ${creators.length} creators with earnings to migrate.`);
    
    // Update each creator's earningsBalance
    for (const creator of creators) {
      const creatorId = creator.creatorId;
      const totalEarnings = creator._sum.amount || 0;
      
      console.log(`Updating creator ${creatorId} with earnings balance of ${totalEarnings}`);
      
      // Update the user's earningsBalance using raw SQL to avoid type issues
      await prisma.$executeRaw`
        UPDATE "users"
        SET "earningsBalance" = ${totalEarnings}
        WHERE id = ${creatorId}
      `;
    }
    
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateEarningsBalance()
  .then(() => console.log('Script execution completed.'))
  .catch(e => console.error('Script execution failed:', e)); 