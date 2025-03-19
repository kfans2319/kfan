#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const timeRange = args[0] || 'today'; // Default to today if no arg provided
const limit = parseInt(args[1]) || 5; // Number of recent users to show, default 5

async function runUserAnalytics(timeRange, limit) {
  try {
    // Get current date
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    // Set start date based on time range
    let startDate;
    let rangeLabel;
    
    switch(timeRange.toLowerCase()) {
      case 'today':
        startDate = today;
        rangeLabel = 'Today';
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        rangeLabel = 'Yesterday';
        break;
      case 'week':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        rangeLabel = 'Last 7 days';
        break;
      case 'month':
        startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - 1);
        rangeLabel = 'Last 30 days';
        break;
      case 'quarter':
        startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - 3);
        rangeLabel = 'Last 90 days';
        break;
      case 'year':
        startDate = new Date(today);
        startDate.setFullYear(startDate.getFullYear() - 1);
        rangeLabel = 'Last 365 days';
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        rangeLabel = 'All time';
        break;
      default:
        // Try to parse as YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(timeRange)) {
          startDate = new Date(timeRange);
          if (isNaN(startDate.getTime())) {
            throw new Error('Invalid date format. Use YYYY-MM-DD');
          }
          rangeLabel = `Since ${timeRange}`;
        } else {
          throw new Error('Invalid time range. Use today, yesterday, week, month, quarter, year, all, or YYYY-MM-DD');
        }
    }
    
    // Count users in the specified time range
    const userCount = await prisma.user.count({
      where: {
        createdAt: {
          gte: startDate,
          ...(timeRange.toLowerCase() === 'today' ? {} : { lt: now })
        }
      }
    });
    
    // Get total user count
    const totalCount = await prisma.user.count();
    
    // Count verified vs. unverified users in the time range
    const verifiedCount = await prisma.user.count({
      where: {
        createdAt: {
          gte: startDate,
          ...(timeRange.toLowerCase() === 'today' ? {} : { lt: now })
        },
        isVerified: true
      }
    });
    
    // Get user signups by hour (for today) or by day (for other ranges)
    let timeSeriesData = [];
    
    if (timeRange.toLowerCase() === 'today') {
      // Get hourly breakdown for today
      const hourCounts = [];
      
      for (let hour = 0; hour < 24; hour++) {
        const hourStart = new Date(today);
        hourStart.setHours(hour, 0, 0, 0);
        
        const hourEnd = new Date(today);
        hourEnd.setHours(hour + 1, 0, 0, 0);
        
        // Skip future hours
        if (hourEnd > now) continue;
        
        const count = await prisma.user.count({
          where: {
            createdAt: {
              gte: hourStart,
              lt: hourEnd
            }
          }
        });
        
        hourCounts.push({
          hour,
          count,
          label: `${hour}:00 - ${hour + 1}:00`
        });
      }
      
      timeSeriesData = hourCounts;
    } else if (timeRange.toLowerCase() !== 'yesterday') {
      // For ranges longer than a day, get daily counts
      const numberOfDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
      const dailyCounts = [];
      
      // Limit to last 30 data points for readability
      const daysToShow = Math.min(numberOfDays, 30);
      
      for (let i = 0; i < daysToShow; i++) {
        const dayStart = new Date(now);
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        
        const count = await prisma.user.count({
          where: {
            createdAt: {
              gte: dayStart,
              lt: dayEnd
            }
          }
        });
        
        dailyCounts.unshift({
          date: dayStart.toISOString().split('T')[0],
          count
        });
      }
      
      timeSeriesData = dailyCounts;
    }
    
    // Get the most recent users
    const recentUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        createdAt: true,
        isVerified: true,
        verificationStatus: true,
        avatarUrl: true
      },
      where: {
        createdAt: {
          gte: startDate
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
    
    // Calculate statistics
    const verificationRate = userCount > 0 ? (verifiedCount / userCount * 100).toFixed(2) : 0;
    const percentOfTotal = totalCount > 0 ? (userCount / totalCount * 100).toFixed(2) : 0;
    
    // Display results
    console.log('\n=== USER SIGNUP ANALYTICS ===');
    console.log(`Report for: ${rangeLabel}`);
    console.log(`Generated: ${now.toISOString().split('T')[0]} at ${now.toISOString().split('T')[1].slice(0, 8)}`);
    console.log('-------------------------------');
    console.log(`New users: ${userCount}`);
    console.log(`Verified users: ${verifiedCount} (${verificationRate}%)`);
    console.log(`Unverified users: ${userCount - verifiedCount}`);
    console.log(`Percentage of all users: ${percentOfTotal}%`);
    console.log(`Total users in system: ${totalCount}`);
    
    // Display time series data if available
    if (timeSeriesData.length > 0) {
      console.log('\n=== SIGNUP DISTRIBUTION ===');
      
      if (timeRange.toLowerCase() === 'today') {
        // For hourly data
        timeSeriesData.forEach(hour => {
          const bar = '█'.repeat(Math.min(hour.count, 50));
          console.log(`${hour.label.padEnd(12)} | ${bar} ${hour.count}`);
        });
      } else {
        // For daily data
        console.log('\nDaily signups:');
        timeSeriesData.forEach(day => {
          const bar = '█'.repeat(Math.min(day.count, 50));
          console.log(`${day.date} | ${bar} ${day.count}`);
        });
      }
    }
    
    // Display recent users
    console.log(`\n=== MOST RECENT SIGNUPS (${recentUsers.length}) ===`);
    recentUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.username} (${user.displayName || 'No display name'})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email || 'None'}`);
      console.log(`   Signed up: ${user.createdAt.toISOString()}`);
      console.log(`   Verified: ${user.isVerified ? 'Yes' : 'No'}`);
      console.log(`   Verification status: ${user.verificationStatus || 'Not submitted'}`);
      console.log(`   Has avatar: ${user.avatarUrl ? 'Yes' : 'No'}`);
    });
    
    // Display usage help
    console.log('\n=== USAGE ===');
    console.log('node user-analytics.js [timeRange] [limit]');
    console.log('\nTime ranges:');
    console.log('  today      - Users signed up today (default)');
    console.log('  yesterday  - Users signed up yesterday');
    console.log('  week       - Users signed up in the last 7 days');
    console.log('  month      - Users signed up in the last 30 days');
    console.log('  quarter    - Users signed up in the last 90 days');
    console.log('  year       - Users signed up in the last 365 days');
    console.log('  all        - All users');
    console.log('  YYYY-MM-DD - Users signed up since specific date');
    console.log('\nLimit: Number of recent users to display (default: 5)');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

runUserAnalytics(timeRange, limit); 