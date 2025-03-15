// This script sets a user as an admin by username
// Usage: node scripts/set-admin.js <username>

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get the username from command line arguments
  const username = process.argv[2];
  
  if (!username) {
    console.error('Please provide a username');
    console.error('Usage: node scripts/set-admin.js <username>');
    process.exit(1);
  }
  
  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: {
        username: username,
      },
    });
    
    if (!user) {
      console.error(`User with username ${username} not found`);
      process.exit(1);
    }
    
    // Update the user to be an admin
    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        isAdmin: true,
      },
    });
    
    console.log(`User ${username} (${updatedUser.displayName}) is now an admin`);
    
  } catch (error) {
    console.error('Error setting user as admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 