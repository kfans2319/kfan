#!/usr/bin/env node
// scripts/daily-balance-snapshot.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Initialize Prisma client
const prisma = new PrismaClient();

/**
 * Takes a snapshot of current user balances and stores it for historical tracking.
 * This script is designed to be run daily as a cron job.
 * 
 * Usage:
 *   node daily-balance-snapshot.js [--output-dir DIR]
 */
async function takeBalanceSnapshot() {
  try {
    // Get command line args
    const args = process.argv.slice(2);
    let outputDir = '.';
    
    // Parse output directory if provided
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--output-dir' && i + 1 < args.length) {
        outputDir = args[++i];
      }
    }
    
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timestamp = today.toISOString();
    
    console.log(`[${timestamp}] Taking daily balance snapshot...`);
    
    // Query all users and their balances
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        balance: true,
        earningsBalance: true,
        createdAt: true,
        isVerified: true
      }
    });
    
    // Prepare snapshot directories
    const snapshotDir = path.join(outputDir, 'snapshots');
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    
    // Save detailed snapshot with all user data
    const detailedSnapshotFilename = `balance_snapshot_${dateStr}.json`;
    fs.writeFileSync(
      path.join(snapshotDir, detailedSnapshotFilename),
      JSON.stringify(users, null, 2)
    );
    
    // Save daily summary of total balances
    const summary = {
      date: dateStr,
      timestamp: timestamp,
      totalUsers: users.length,
      usersWithBalance: users.filter(u => parseFloat(u.balance) > 0).length,
      usersWithEarnings: users.filter(u => parseFloat(u.earningsBalance) > 0).length,
      totalBalance: users.reduce((sum, user) => sum + parseFloat(user.balance), 0),
      totalEarnings: users.reduce((sum, user) => sum + parseFloat(user.earningsBalance), 0)
    };
    
    // Append to daily summaries file
    const summaryFile = path.join(snapshotDir, 'balance_summaries.csv');
    const summaryExists = fs.existsSync(summaryFile);
    
    // Create CSV header if it doesn't exist
    const csvHeader = 'Date,Timestamp,TotalUsers,UsersWithBalance,UsersWithEarnings,TotalBalance,TotalEarnings';
    
    // Create the CSV row
    const csvRow = `${summary.date},${summary.timestamp},${summary.totalUsers},${summary.usersWithBalance},${summary.usersWithEarnings},${summary.totalBalance.toFixed(2)},${summary.totalEarnings.toFixed(2)}`;
    
    if (summaryExists) {
      // Append to existing file
      fs.appendFileSync(summaryFile, '\n' + csvRow);
    } else {
      // Create new file with header
      fs.writeFileSync(summaryFile, csvHeader + '\n' + csvRow);
    }
    
    console.log(`[${timestamp}] Snapshot complete!`);
    console.log(`Detailed snapshot saved to: snapshots/${detailedSnapshotFilename}`);
    console.log(`Summary stats appended to: snapshots/balance_summaries.csv`);
    
    // Also save a copy as "latest" for easy access
    fs.copyFileSync(
      path.join(snapshotDir, detailedSnapshotFilename),
      path.join(snapshotDir, 'latest_balance_snapshot.json')
    );
    
    // Print summary
    console.log('\nSummary Statistics:');
    console.log(`Total Users: ${summary.totalUsers}`);
    console.log(`Users with Balance: ${summary.usersWithBalance}`);
    console.log(`Users with Earnings: ${summary.usersWithEarnings}`);
    console.log(`Total Balance: $${summary.totalBalance.toFixed(2)}`);
    console.log(`Total Earnings: $${summary.totalEarnings.toFixed(2)}`);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the snapshot
takeBalanceSnapshot(); 