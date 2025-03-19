const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { id: 'bbx26z4rvpf7qmic' }
    });
    
    console.log('User found:', user);
    
    if (!user) {
      console.log('User not found in database');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser(); 