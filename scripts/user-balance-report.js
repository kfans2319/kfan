const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

// Initialize Prisma client
const prisma = new PrismaClient();

async function generateUserBalanceReport() {
  console.log("Generating comprehensive user balance report...");
  
  try {
    // 1. Find users with positive payment balance
    const usersWithBalance = await prisma.user.findMany({
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
        isVerified: true
      },
      orderBy: {
        balance: 'desc'
      }
    });

    // 2. Find users with positive earnings balance
    const usersWithEarnings = await prisma.user.findMany({
      where: {
        earningsBalance: {
          gt: 0
        }
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        earningsBalance: true,
        createdAt: true,
        isVerified: true
      },
      orderBy: {
        earningsBalance: 'desc'
      }
    });

    // 3. Find accounts with both types of balances
    const userIds = new Set(usersWithBalance.map(u => u.id));
    const usersWithBoth = usersWithEarnings.filter(u => userIds.has(u.id));
    
    // 4. Get creator earnings data
    const creatorEarnings = await prisma.creatorEarning.groupBy({
      by: ['creatorId'],
      _sum: {
        amount: true,
        platformFee: true
      }
    });
    
    // Convert earnings to a map for easy lookup
    const earningsMap = creatorEarnings.reduce((acc, curr) => {
      acc[curr.creatorId] = {
        grossEarnings: curr._sum.amount.add(curr._sum.platformFee || 0),
        netEarnings: curr._sum.amount,
        platformFees: curr._sum.platformFee || 0
      };
      return acc;
    }, {});

    // 5. Generate report
    console.log("\n=== USER PAYMENT BALANCE REPORT ===\n");
    console.log(`Total users with payment balance: ${usersWithBalance.length}`);
    const totalPaymentBalance = usersWithBalance.reduce((sum, user) => 
      sum + parseFloat(user.balance), 0);
    console.log(`Total payment balance: $${totalPaymentBalance.toFixed(2)}`);
    
    console.log("\n=== USER EARNINGS BALANCE REPORT ===\n");
    console.log(`Total users with earnings balance: ${usersWithEarnings.length}`);
    const totalEarningsBalance = usersWithEarnings.reduce((sum, user) => 
      sum + parseFloat(user.earningsBalance), 0);
    console.log(`Total earnings balance: $${totalEarningsBalance.toFixed(2)}`);
    
    console.log("\n=== USERS WITH BOTH BALANCES ===\n");
    console.log(`Total users with both balances: ${usersWithBoth.length}`);
    
    // 6. Detailed user listings
    console.log("\n=== TOP 5 USERS BY PAYMENT BALANCE ===\n");
    usersWithBalance.slice(0, 5).forEach(user => {
      console.log(`User: ${user.displayName || user.username} (${user.email || 'No email'})`);
      console.log(`ID: ${user.id}`);
      console.log(`Payment Balance: $${parseFloat(user.balance).toFixed(2)}`);
      console.log(`Verified: ${user.isVerified ? 'Yes' : 'No'}`);
      console.log(`Account created: ${user.createdAt.toLocaleDateString()}`);
      console.log('-----------------------------------');
    });
    
    console.log("\n=== TOP 5 USERS BY EARNINGS BALANCE ===\n");
    usersWithEarnings.slice(0, 5).forEach(user => {
      console.log(`User: ${user.displayName || user.username} (${user.email || 'No email'})`);
      console.log(`ID: ${user.id}`);
      console.log(`Earnings Balance: $${parseFloat(user.earningsBalance).toFixed(2)}`);
      
      // Add lifetime earnings info if available
      if (earningsMap[user.id]) {
        const earnings = earningsMap[user.id];
        console.log(`Lifetime Gross Earnings: $${parseFloat(earnings.grossEarnings).toFixed(2)}`);
        console.log(`Lifetime Net Earnings: $${parseFloat(earnings.netEarnings).toFixed(2)}`);
        console.log(`Lifetime Platform Fees: $${parseFloat(earnings.platformFees).toFixed(2)}`);
      }
      
      console.log(`Verified: ${user.isVerified ? 'Yes' : 'No'}`);
      console.log(`Account created: ${user.createdAt.toLocaleDateString()}`);
      console.log('-----------------------------------');
    });
    
    // 7. Export to CSV
    const dateStr = new Date().toISOString().split('T')[0];
    
    // Payment balance CSV
    const paymentBalanceCsv = [
      'ID,Username,Display Name,Email,Payment Balance,Verified,Account Created Date',
      ...usersWithBalance.map(user => 
        `${user.id},${user.username},${(user.displayName || '').replace(/,/g, ' ')},${user.email || ''},${user.balance},${user.isVerified},${user.createdAt.toISOString().split('T')[0]}`
      )
    ].join('\n');
    const paymentFilename = `users-payment-balance-${dateStr}.csv`;
    fs.writeFileSync(paymentFilename, paymentBalanceCsv);
    
    // Earnings balance CSV
    const earningsBalanceCsv = [
      'ID,Username,Display Name,Email,Earnings Balance,Verified,Account Created Date,Lifetime Gross Earnings,Lifetime Net Earnings,Lifetime Platform Fees',
      ...usersWithEarnings.map(user => {
        const earnings = earningsMap[user.id] || { grossEarnings: 0, netEarnings: 0, platformFees: 0 };
        return `${user.id},${user.username},${(user.displayName || '').replace(/,/g, ' ')},${user.email || ''},${user.earningsBalance},${user.isVerified},${user.createdAt.toISOString().split('T')[0]},${earnings.grossEarnings || 0},${earnings.netEarnings || 0},${earnings.platformFees || 0}`;
      })
    ].join('\n');
    const earningsFilename = `users-earnings-balance-${dateStr}.csv`;
    fs.writeFileSync(earningsFilename, earningsBalanceCsv);
    
    console.log(`\nCSV exports created:`);
    console.log(`- ${paymentFilename}`);
    console.log(`- ${earningsFilename}`);
    
  } catch (error) {
    console.error('Error generating user balance report:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
generateUserBalanceReport(); 