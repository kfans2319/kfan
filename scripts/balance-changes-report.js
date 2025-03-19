const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Initialize Prisma client
const prisma = new PrismaClient();

/**
 * Generates a report of users who have added money to their account
 * within a specified date range.
 * 
 * Note: Since there's no Transaction model in the database, this script
 * estimates transactions by comparing snapshots of user balances.
 * For accurate results, run this script regularly (daily/weekly).
 */
async function generateBalanceChangeReport(options = {}) {
  // Default options
  const defaultOptions = {
    startDate: null, // If null, no start date filter
    endDate: null,   // If null, uses current date
    minAmount: 0,    // Minimum transaction amount to include
    outputDir: '.',  // Directory to save reports
    usePreviousSnapshot: true, // Whether to use the previous snapshot for comparison
  };
  
  const opts = { ...defaultOptions, ...options };
  console.log("Generating balance change report with options:", opts);
  
  // Format dates for display and filenames
  const today = new Date();
  const endDate = opts.endDate ? new Date(opts.endDate) : today;
  const startDate = opts.startDate ? new Date(opts.startDate) : null;
  
  const dateRangeStr = startDate 
    ? `${formatDate(startDate)}_to_${formatDate(endDate)}` 
    : `as_of_${formatDate(endDate)}`;
  
  try {
    // Step 1: Get current user balances
    const currentUsers = await prisma.user.findMany({
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
    
    // Step 2: Load previous snapshot if it exists and option is enabled
    let previousUsers = [];
    const snapshotDir = path.join(opts.outputDir, 'snapshots');
    
    // Create snapshot directory if it doesn't exist
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    
    if (opts.usePreviousSnapshot) {
      try {
        // Find the most recent snapshot file
        const files = fs.readdirSync(snapshotDir)
          .filter(file => file.startsWith('balance_snapshot_'))
          .sort()
          .reverse();
          
        if (files.length > 0) {
          const latestSnapshot = fs.readFileSync(
            path.join(snapshotDir, files[0]), 
            'utf8'
          );
          previousUsers = JSON.parse(latestSnapshot);
          console.log(`Loaded previous snapshot from ${files[0]}`);
        } else {
          console.log("No previous snapshot found");
        }
      } catch (err) {
        console.error("Error loading previous snapshot:", err);
      }
    }
    
    // Step 3: Create current snapshot
    const snapshotFilename = `balance_snapshot_${formatDate(today)}.json`;
    fs.writeFileSync(
      path.join(snapshotDir, snapshotFilename),
      JSON.stringify(currentUsers, null, 2)
    );
    console.log(`Created new balance snapshot: ${snapshotFilename}`);
    
    // Step 4: Identify users with balance changes
    const balanceChanges = [];
    const previousUserMap = new Map(
      previousUsers.map(user => [user.id, user])
    );
    
    for (const currentUser of currentUsers) {
      const previousUser = previousUserMap.get(currentUser.id);
      
      if (!previousUser) {
        // New user with balance
        if (parseFloat(currentUser.balance) > opts.minAmount) {
          balanceChanges.push({
            id: currentUser.id,
            username: currentUser.username,
            displayName: currentUser.displayName,
            email: currentUser.email,
            previousBalance: 0,
            currentBalance: parseFloat(currentUser.balance),
            change: parseFloat(currentUser.balance),
            isNewUser: true,
            createdAt: currentUser.createdAt,
            isVerified: currentUser.isVerified
          });
        }
      } else {
        // Existing user with balance change
        const previousBalance = parseFloat(previousUser.balance);
        const currentBalance = parseFloat(currentUser.balance);
        const change = currentBalance - previousBalance;
        
        // Only include if the change is positive and above minimum amount
        if (change > opts.minAmount) {
          balanceChanges.push({
            id: currentUser.id,
            username: currentUser.username,
            displayName: currentUser.displayName,
            email: currentUser.email,
            previousBalance,
            currentBalance,
            change,
            isNewUser: false,
            createdAt: currentUser.createdAt,
            isVerified: currentUser.isVerified
          });
        }
      }
    }
    
    // Filter by date if specified
    const filteredChanges = startDate 
      ? balanceChanges.filter(user => {
          if (user.isNewUser) {
            return user.createdAt >= startDate && user.createdAt <= endDate;
          }
          // For existing users, we can't know exactly when the change happened
          // so we include them all when filtering by date
          return true;
        })
      : balanceChanges;
    
    // Sort by change amount (descending)
    filteredChanges.sort((a, b) => b.change - a.change);
    
    // Step 5: Generate report
    console.log(`\n=== BALANCE CHANGE REPORT: ${dateRangeStr} ===\n`);
    console.log(`Total users with balance increases: ${filteredChanges.length}`);
    
    const totalIncrease = filteredChanges.reduce(
      (sum, user) => sum + user.change, 0
    );
    console.log(`Total balance increase: $${totalIncrease.toFixed(2)}`);
    
    // Detailed listing (top 10)
    console.log("\n=== TOP 10 USERS BY BALANCE INCREASE ===\n");
    filteredChanges.slice(0, 10).forEach(user => {
      console.log(`User: ${user.displayName || user.username} (${user.email || 'No email'})`);
      console.log(`ID: ${user.id}`);
      console.log(`Previous Balance: $${user.previousBalance.toFixed(2)}`);
      console.log(`Current Balance: $${user.currentBalance.toFixed(2)}`);
      console.log(`Increase: $${user.change.toFixed(2)}`);
      console.log(`New User: ${user.isNewUser ? 'Yes' : 'No'}`);
      console.log(`Verified: ${user.isVerified ? 'Yes' : 'No'}`);
      console.log('-----------------------------------');
    });
    
    // Step 6: Export to CSV
    const reportDir = path.join(opts.outputDir, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const csvContent = [
      'ID,Username,Display Name,Email,Previous Balance,Current Balance,Increase,New User,Verified,Account Created',
      ...filteredChanges.map(user => 
        `${user.id},${user.username},${(user.displayName || '').replace(/,/g, ' ')},${user.email || ''},${user.previousBalance.toFixed(2)},${user.currentBalance.toFixed(2)},${user.change.toFixed(2)},${user.isNewUser},${user.isVerified},${formatDate(user.createdAt)}`
      )
    ].join('\n');
    
    const filename = `balance_changes_${dateRangeStr}.csv`;
    fs.writeFileSync(path.join(reportDir, filename), csvContent);
    console.log(`\nCSV report created: reports/${filename}`);
    
    // Return the results
    return {
      users: filteredChanges,
      totalUsers: filteredChanges.length,
      totalIncrease
    };
    
  } catch (error) {
    console.error('Error generating balance change report:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to format dates consistently
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--start-date' && i + 1 < args.length) {
      options.startDate = args[++i];
    } else if (arg === '--end-date' && i + 1 < args.length) {
      options.endDate = args[++i];
    } else if (arg === '--min-amount' && i + 1 < args.length) {
      options.minAmount = parseFloat(args[++i]);
    } else if (arg === '--output-dir' && i + 1 < args.length) {
      options.outputDir = args[++i];
    } else if (arg === '--no-snapshot') {
      options.usePreviousSnapshot = false;
    } else if (arg === '--help') {
      console.log(`
Usage: node balance-changes-report.js [options]

Options:
  --start-date DATE    Start date for the report (YYYY-MM-DD)
  --end-date DATE      End date for the report (YYYY-MM-DD)
  --min-amount AMOUNT  Minimum amount to include (default: 0)
  --output-dir DIR     Directory to save reports (default: current dir)
  --no-snapshot        Don't use previous snapshot for comparison
  --help               Show this help message
      `);
      process.exit(0);
    }
  }
  
  return options;
}

// Run the script
const options = parseArgs();
generateBalanceChangeReport(options); 