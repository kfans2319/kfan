// This script lists all users in the database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Find all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        isAdmin: true,
        isVerified: true,
        verificationStatus: true,
      },
    });
    
    console.log('Users in the database:');
    console.log('====================');
    
    users.forEach(user => {
      console.log(`Username: ${user.username}`);
      console.log(`Display Name: ${user.displayName}`);
      console.log(`Admin: ${user.isAdmin ? 'Yes' : 'No'}`);
      console.log(`Verified: ${user.isVerified ? 'Yes' : 'No'}`);
      console.log(`Verification Status: ${user.verificationStatus}`);
      console.log('--------------------');
    });
    
    console.log(`Total users: ${users.length}`);
    
  } catch (error) {
    console.error('Error listing users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 