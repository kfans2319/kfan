#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const prisma = new PrismaClient();

// Command line args
const args = process.argv.slice(2);
const month = args[0] ? parseInt(args[0]) - 1 : new Date().getMonth(); // 1-12 for user input, 0-11 for JS
const year = args[1] ? parseInt(args[1]) : new Date().getFullYear();
const outputDir = args[2] || './reports';

async function generateMonthlyReport(month, year, outputDir) {
  try {
    console.log(`Generating report for ${year}-${month + 1}...`);
    
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Define date range for the month
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
    
    // Define date range for previous month (for comparison)
    const startOfPrevMonth = new Date(year, month - 1, 1);
    const endOfPrevMonth = new Date(year, month, 0, 23, 59, 59, 999);
    
    // Get all users who signed up in the specified month
    const users = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        isVerified: true,
        verificationStatus: true,
        avatarUrl: true,
        bannerImageUrl: true
      }
    });
    
    // Count total users in the system
    const totalUsers = await prisma.user.count();
    
    // Count users from previous month
    const prevMonthUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: startOfPrevMonth,
          lte: endOfPrevMonth
        }
      }
    });
    
    // Calculate daily signups
    const dailySignups = {};
    const daysInMonth = endOfMonth.getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const nextDate = new Date(year, month, day + 1);
      
      const count = await prisma.user.count({
        where: {
          createdAt: {
            gte: date,
            lt: nextDate
          }
        }
      });
      
      dailySignups[day] = count;
    }
    
    // Find highest and lowest signup days
    let highestDay = 1;
    let highestCount = 0;
    let lowestDay = 1;
    let lowestCount = Number.MAX_SAFE_INTEGER;
    
    for (const [day, count] of Object.entries(dailySignups)) {
      if (count > highestCount) {
        highestCount = count;
        highestDay = parseInt(day);
      }
      if (count < lowestCount) {
        lowestCount = count;
        lowestDay = parseInt(day);
      }
    }
    
    // Compute verification stats
    const verifiedCount = users.filter(user => user.isVerified).length;
    const pendingVerificationCount = users.filter(user => user.verificationStatus === 'PENDING').length;
    const approvedVerificationCount = users.filter(user => user.verificationStatus === 'APPROVED').length;
    const rejectedVerificationCount = users.filter(user => user.verificationStatus === 'REJECTED').length;
    
    // Compute profile completeness
    const withAvatarCount = users.filter(user => user.avatarUrl).length;
    const withBannerCount = users.filter(user => user.bannerImageUrl).length;
    const withBothImagesCount = users.filter(user => user.avatarUrl && user.bannerImageUrl).length;
    
    // Generate report object
    const report = {
      reportPeriod: {
        month: month + 1,
        year: year,
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString()
      },
      summary: {
        totalNewUsers: users.length,
        changeFromPreviousMonth: prevMonthUsers > 0 
          ? ((users.length - prevMonthUsers) / prevMonthUsers * 100).toFixed(2) + '%'
          : 'N/A',
        percentageOfTotalUsers: ((users.length / totalUsers) * 100).toFixed(2) + '%',
        averageSignupsPerDay: (users.length / daysInMonth).toFixed(2),
        highestSignupDay: {
          day: highestDay,
          count: highestCount
        },
        lowestSignupDay: {
          day: lowestDay,
          count: lowestCount
        }
      },
      verificationStats: {
        verifiedUsers: verifiedCount,
        verificationRate: users.length > 0 ? ((verifiedCount / users.length) * 100).toFixed(2) + '%' : '0%',
        pendingVerification: pendingVerificationCount,
        approvedVerification: approvedVerificationCount,
        rejectedVerification: rejectedVerificationCount
      },
      profileCompleteness: {
        withAvatar: withAvatarCount,
        avatarRate: users.length > 0 ? ((withAvatarCount / users.length) * 100).toFixed(2) + '%' : '0%',
        withBanner: withBannerCount,
        bannerRate: users.length > 0 ? ((withBannerCount / users.length) * 100).toFixed(2) + '%' : '0%',
        withBothImages: withBothImagesCount,
        bothImagesRate: users.length > 0 ? ((withBothImagesCount / users.length) * 100).toFixed(2) + '%' : '0%'
      },
      dailySignups: dailySignups,
      users: users.slice(0, 100).map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        signupDate: user.createdAt,
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus || 'NONE',
        hasAvatar: !!user.avatarUrl,
        hasBanner: !!user.bannerImageUrl
      }))
    };
    
    // Save report to file
    const filename = `user-report-${year}-${String(month + 1).padStart(2, '0')}.json`;
    const filePath = path.join(outputDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    
    // Generate text report for console output
    console.log('\n=== MONTHLY USER REPORT ===');
    console.log(`Period: ${startOfMonth.toLocaleString('default', { month: 'long' })} ${year}`);
    console.log('----------------------------');
    console.log(`New users: ${users.length}`);
    console.log(`Change from previous month: ${report.summary.changeFromPreviousMonth}`);
    console.log(`Percentage of total users: ${report.summary.percentageOfTotalUsers}`);
    console.log(`Average signups per day: ${report.summary.averageSignupsPerDay}`);
    console.log(`Highest signup day: Day ${report.summary.highestSignupDay.day} (${report.summary.highestSignupDay.count} users)`);
    console.log(`Lowest signup day: Day ${report.summary.lowestSignupDay.day} (${report.summary.lowestSignupDay.count} users)`);
    console.log('\n=== VERIFICATION STATS ===');
    console.log(`Verified users: ${verifiedCount} (${report.verificationStats.verificationRate})`);
    console.log(`Pending verification: ${pendingVerificationCount}`);
    console.log(`Approved verification: ${approvedVerificationCount}`);
    console.log(`Rejected verification: ${rejectedVerificationCount}`);
    console.log('\n=== PROFILE COMPLETENESS ===');
    console.log(`Users with avatar: ${withAvatarCount} (${report.profileCompleteness.avatarRate})`);
    console.log(`Users with banner: ${withBannerCount} (${report.profileCompleteness.bannerRate})`);
    console.log(`Users with both images: ${withBothImagesCount} (${report.profileCompleteness.bothImagesRate})`);
    
    console.log('\n=== DAILY SIGNUPS ===');
    Object.entries(dailySignups).forEach(([day, count]) => {
      const bar = '█'.repeat(Math.min(count, 50));
      console.log(`Day ${String(day).padStart(2, ' ')}: ${bar} ${count}`);
    });
    
    console.log(`\nDetailed report saved to: ${filePath}`);
    
    return { report, filePath };
  } catch (error) {
    console.error('Error generating report:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the report generation
generateMonthlyReport(month, year, outputDir); 