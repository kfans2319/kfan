const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function countTodaysUsers() {
  try {
    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get yesterday's date (start of day)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Get start of this week
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday is 0
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Get start of this month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Count users who signed up today
    const todayCount = await prisma.user.count({
      where: {
        createdAt: {
          gte: today
        }
      }
    });
    
    // Count users who signed up yesterday
    const yesterdayCount = await prisma.user.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: today
        }
      }
    });
    
    // Count users who signed up this week
    const thisWeekCount = await prisma.user.count({
      where: {
        createdAt: {
          gte: startOfWeek
        }
      }
    });
    
    // Count users who signed up this month
    const thisMonthCount = await prisma.user.count({
      where: {
        createdAt: {
          gte: startOfMonth
        }
      }
    });
    
    // Get total user count
    const totalCount = await prisma.user.count();
    
    // Get the 5 most recent users with their details
    const recentUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        createdAt: true,
        isVerified: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    // Format and display the results
    console.log('\n=== USER SIGNUP STATISTICS ===');
    console.log(`Date: ${today.toISOString().split('T')[0]}`);
    console.log(`Time: ${new Date().toISOString().split('T')[1].slice(0, 8)}`);
    console.log('----------------------------');
    console.log(`New users today: ${todayCount}`);
    console.log(`New users yesterday: ${yesterdayCount}`);
    console.log(`New users this week: ${thisWeekCount}`);
    console.log(`New users this month: ${thisMonthCount}`);
    console.log(`Total users: ${totalCount}`);
    
    // Calculate daily growth rate
    const growthRate = yesterdayCount > 0 
      ? ((todayCount / yesterdayCount - 1) * 100).toFixed(2)
      : 'N/A';
    
    console.log(`Daily growth rate: ${growthRate}%`);
    
    // Monthly average (users this month / days in month so far)
    const dayOfMonth = today.getDate();
    const avgPerDay = (thisMonthCount / dayOfMonth).toFixed(2);
    console.log(`Average new users per day this month: ${avgPerDay}`);
    
    // Display recent users
    console.log('\n=== MOST RECENT SIGNUPS ===');
    recentUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.username} (${user.displayName || 'No display name'})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Signed up: ${user.createdAt.toISOString()}`);
      console.log(`   Verified: ${user.isVerified ? 'Yes' : 'No'}`);
    });
    
  } catch (error) {
    console.error('Error counting users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

countTodaysUsers(); 