const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient();

async function findUsersWithBalance() {
  console.log("Fetching users with positive balance...");
  
  try {
    // Query users with balance > 0
    const users = await prisma.user.findMany({
      where: {
        balance: {
          gt: 0
        }
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        balance: true,
        createdAt: true,
        // We could include other fields like transactions if they existed
      },
      orderBy: {
        balance: 'desc'
      }
    });

    // Print results to console
    console.log(`\n=== FOUND ${users.length} USERS WITH POSITIVE BALANCE ===\n`);
    
    let totalBalance = 0;
    let maxBalance = 0;
    let userWithMaxBalance = null;

    users.forEach(user => {
      const balanceNumber = parseFloat(user.balance);
      totalBalance += balanceNumber;
      
      if (balanceNumber > maxBalance) {
        maxBalance = balanceNumber;
        userWithMaxBalance = user;
      }
      
      console.log(`User: ${user.displayName || user.username} (${user.email || 'No email'})`);
      console.log(`ID: ${user.id}`);
      console.log(`Balance: $${balanceNumber.toFixed(2)}`);
      console.log(`Account created: ${user.createdAt.toLocaleDateString()}`);
      console.log('-----------------------------------');
    });

    // Print summary statistics
    console.log(`\n=== SUMMARY STATISTICS ===\n`);
    console.log(`Total users with balance: ${users.length}`);
    console.log(`Total balance across all users: $${totalBalance.toFixed(2)}`);
    console.log(`Average balance per user: $${(totalBalance / (users.length || 1)).toFixed(2)}`);
    
    if (userWithMaxBalance) {
      console.log(`\nUser with highest balance: ${userWithMaxBalance.displayName || userWithMaxBalance.username}`);
      console.log(`Highest balance: $${maxBalance.toFixed(2)}`);
    }
    
    // Export to CSV if needed
    const fs = require('fs');
    const csvContent = [
      'ID,Username,Display Name,Email,Balance,Account Created Date',
      ...users.map(user => 
        `${user.id},${user.username},${(user.displayName || '').replace(/,/g, ' ')},${user.email || ''},${user.balance},${user.createdAt.toISOString().split('T')[0]}`
      )
    ].join('\n');

    const filename = `users-with-balance-${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, csvContent);
    console.log(`\nCSV export: ${filename}`);
    
  } catch (error) {
    console.error('Error fetching users with balance:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
findUsersWithBalance(); 