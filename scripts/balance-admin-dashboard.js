#!/usr/bin/env node
// scripts/balance-admin-dashboard.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Initialize Prisma client
const prisma = new PrismaClient();

/**
 * Comprehensive admin dashboard for balance monitoring.
 * Provides a complete overview of user payment and earnings balances
 * with detailed stats and trend analysis.
 */
async function generateBalanceDashboard() {
  try {
    console.log("Generating comprehensive balance admin dashboard...");
    
    // Create output directory if it doesn't exist
    const outputDir = path.join('.', 'admin-reports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Get today's date for filenames
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    // 1. Get current user data
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        balance: true,
        earningsBalance: true,
        createdAt: true,
        isVerified: true,
        isAdmin: true
      }
    });
    
    // 2. Get creator earnings data
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
    
    // 3. Calculate summary statistics
    // Pre-calculate aggregations to avoid stack overflows
    let totalBalance = 0;
    let totalEarningsBalance = 0;
    let verifiedCount = 0;
    let usersWithBalanceCount = 0;
    let usersWithEarningsCount = 0;
    let maxBalanceValue = 0;
    let maxEarningsValue = 0;
    let newUsers24hCount = 0;
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Iterate once through users to calculate all stats
    for (const user of users) {
      const balanceValue = parseFloat(user.balance);
      const earningsValue = parseFloat(user.earningsBalance);
      
      // Add to totals
      totalBalance += balanceValue;
      totalEarningsBalance += earningsValue;
      
      // Count verified users
      if (user.isVerified) {
        verifiedCount++;
      }
      
      // Count users with balance
      if (balanceValue > 0) {
        usersWithBalanceCount++;
        // Track max balance
        if (balanceValue > maxBalanceValue) {
          maxBalanceValue = balanceValue;
        }
      }
      
      // Count users with earnings
      if (earningsValue > 0) {
        usersWithEarningsCount++;
        // Track max earnings
        if (earningsValue > maxEarningsValue) {
          maxEarningsValue = earningsValue;
        }
      }
      
      // Count new users in last 24h
      if (new Date(user.createdAt) >= yesterday) {
        newUsers24hCount++;
      }
    }
    
    // Calculate total platform fees
    let totalPlatformFeesValue = 0;
    for (const earning of creatorEarnings) {
      totalPlatformFeesValue += parseFloat(earning._sum.platformFee || 0);
    }
    
    // Create stats object
    const stats = {
      // User stats
      totalUsers: users.length,
      verifiedUsers: verifiedCount,
      
      // Balance stats
      usersWithBalance: usersWithBalanceCount,
      totalBalance: totalBalance,
      avgBalance: users.length > 0 ? totalBalance / users.length : 0,
      maxBalance: maxBalanceValue,
      
      // Earnings stats
      usersWithEarnings: usersWithEarningsCount,
      totalEarnings: totalEarningsBalance,
      avgEarnings: users.length > 0 ? totalEarningsBalance / users.length : 0,
      maxEarnings: maxEarningsValue,
      
      // Platform earnings (via fees)
      totalPlatformFees: totalPlatformFeesValue,
        
      // Time-based stats
      newUsers24h: newUsers24hCount,
      
      // Active creators (have earnings)
      activeCreators: creatorEarnings.length
    };
    
    // 4. Generate reports
    console.log("\n=== BALANCE ADMIN DASHBOARD ===\n");
    
    // 4.1. Print summary statistics
    console.log("=== SUMMARY STATISTICS ===");
    console.log(`Total Users: ${stats.totalUsers} (${stats.verifiedUsers} verified)`);
    console.log(`New Users (24h): ${stats.newUsers24h}`);
    console.log(`Active Creators: ${stats.activeCreators}`);
    console.log(`\nPayment Balances:`);
    console.log(`- Users with Balance: ${stats.usersWithBalance} (${Math.round(stats.usersWithBalance / stats.totalUsers * 100)}% of users)`);
    console.log(`- Total Balance: $${stats.totalBalance.toFixed(2)}`);
    console.log(`- Average Balance: $${stats.avgBalance.toFixed(2)}`);
    console.log(`- Highest Balance: $${stats.maxBalance.toFixed(2)}`);
    console.log(`\nEarnings Balances:`);
    console.log(`- Users with Earnings: ${stats.usersWithEarnings} (${Math.round(stats.usersWithEarnings / stats.totalUsers * 100)}% of users)`);
    console.log(`- Total Earnings Balance: $${stats.totalEarnings.toFixed(2)}`);
    console.log(`- Average Earnings: $${stats.avgEarnings.toFixed(2)}`);
    console.log(`- Highest Earnings: $${stats.maxEarnings.toFixed(2)}`);
    console.log(`\nPlatform Revenue:`);
    console.log(`- Total Platform Fees: $${stats.totalPlatformFees.toFixed(2)}`);
    
    // 4.2. Top users by balance
    console.log("\n=== TOP 10 USERS BY PAYMENT BALANCE ===");
    const topBalanceUsers = [...users]
      .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance))
      .slice(0, 10);
      
    topBalanceUsers.forEach((user, i) => {
      console.log(`${i+1}. ${user.displayName || user.username}: $${parseFloat(user.balance).toFixed(2)}`);
    });
    
    // 4.3. Top users by earnings
    console.log("\n=== TOP 10 USERS BY EARNINGS BALANCE ===");
    const topEarningsUsers = [...users]
      .sort((a, b) => parseFloat(b.earningsBalance) - parseFloat(a.earningsBalance))
      .slice(0, 10);
      
    topEarningsUsers.forEach((user, i) => {
      console.log(`${i+1}. ${user.displayName || user.username}: $${parseFloat(user.earningsBalance).toFixed(2)}`);
    });
    
    // 4.4. Top earners (lifetime)
    console.log("\n=== TOP 10 CREATORS BY LIFETIME EARNINGS ===");
    const creatorEarningsArray = Object.entries(earningsMap)
      .map(([creatorId, earnings]) => ({
        creatorId,
        ...earnings
      }))
      .sort((a, b) => parseFloat(b.netEarnings) - parseFloat(a.netEarnings))
      .slice(0, 10);
      
    // Create a map for faster user lookups
    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});
      
    creatorEarningsArray.forEach((earning, i) => {
      const user = userMap[earning.creatorId];
      const userName = user ? (user.displayName || user.username) : earning.creatorId;
      console.log(`${i+1}. ${userName}: $${parseFloat(earning.netEarnings).toFixed(2)} (gross: $${parseFloat(earning.grossEarnings).toFixed(2)})`);
    });
    
    // 5. Export data to CSV files
    // 5.1. User balance report
    const userBalanceCSV = [
      'ID,Username,Display Name,Email,Payment Balance,Earnings Balance,Verified,Admin,Created Date',
      ...users.map(user => 
        `${user.id},${user.username},${(user.displayName || '').replace(/,/g, ' ')},${user.email || ''},${parseFloat(user.balance).toFixed(2)},${parseFloat(user.earningsBalance).toFixed(2)},${user.isVerified},${user.isAdmin},${user.createdAt.toISOString().split('T')[0]}`
      )
    ].join('\n');
    
    const balanceFilename = `user_balances_${dateStr}.csv`;
    fs.writeFileSync(path.join(outputDir, balanceFilename), userBalanceCSV);
    
    // 5.2. Creator earnings report
    const creatorEarningsCSV = [
      'Creator ID,Username,Display Name,Email,Gross Earnings,Net Earnings,Platform Fees,Current Earnings Balance',
      ...creatorEarningsArray.map(earning => {
        const user = userMap[earning.creatorId] || { 
          username: 'unknown', 
          displayName: 'Unknown User',
          email: '',
          earningsBalance: 0
        };
        
        return `${earning.creatorId},${user.username},${(user.displayName || '').replace(/,/g, ' ')},${user.email || ''},${parseFloat(earning.grossEarnings).toFixed(2)},${parseFloat(earning.netEarnings).toFixed(2)},${parseFloat(earning.platformFees).toFixed(2)},${parseFloat(user.earningsBalance).toFixed(2)}`;
      })
    ].join('\n');
    
    const earningsFilename = `creator_earnings_${dateStr}.csv`;
    fs.writeFileSync(path.join(outputDir, earningsFilename), creatorEarningsCSV);
    
    // 5.3. Dashboard summary
    const summaryData = {
      date: dateStr,
      timestamp: new Date().toISOString(),
      ...stats
    };
    
    const summaryFilename = `balance_dashboard_summary_${dateStr}.json`;
    fs.writeFileSync(
      path.join(outputDir, summaryFilename), 
      JSON.stringify(summaryData, null, 2)
    );
    
    console.log(`\nExported reports:`);
    console.log(`- ${balanceFilename}`);
    console.log(`- ${earningsFilename}`);
    console.log(`- ${summaryFilename}`);
    
    console.log("\nBalance admin dashboard generated successfully!");
    
  } catch (error) {
    console.error('Error generating balance dashboard:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the dashboard generator
generateBalanceDashboard(); 