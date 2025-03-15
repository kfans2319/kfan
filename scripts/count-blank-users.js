/**
 * Count Blank Users Script
 * 
 * This script analyzes the database to count users with "blank" profiles 
 * in different categories:
 * 1. Users without any posts
 * 2. Users without avatar images
 * 3. Users without bio information
 * 4. Completely blank users (no posts, no avatar, no bio)
 */

const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient();

/**
 * Count users without any posts
 */
async function countUsersWithoutPosts() {
  try {
    const count = await prisma.user.count({
      where: {
        posts: {
          none: {}
        }
      }
    });
    
    console.log(`Users without any posts: ${count.toLocaleString()}`);
    return count;
  } catch (error) {
    console.error('Error counting users without posts:', error);
    return 0;
  }
}

/**
 * Count users without avatar images
 */
async function countUsersWithoutAvatars() {
  try {
    const count = await prisma.user.count({
      where: {
        avatarUrl: null
      }
    });
    
    console.log(`Users without avatar images: ${count.toLocaleString()}`);
    return count;
  } catch (error) {
    console.error('Error counting users without avatars:', error);
    return 0;
  }
}

/**
 * Count users without bio information
 */
async function countUsersWithoutBios() {
  try {
    const count = await prisma.user.count({
      where: {
        OR: [
          { bio: null },
          { bio: "" }
        ]
      }
    });
    
    console.log(`Users without bio information: ${count.toLocaleString()}`);
    return count;
  } catch (error) {
    console.error('Error counting users without bios:', error);
    return 0;
  }
}

/**
 * Count completely blank users (no posts, no avatar, no bio)
 */
async function countCompletelyBlankUsers() {
  try {
    const count = await prisma.user.count({
      where: {
        posts: {
          none: {}
        },
        avatarUrl: null,
        OR: [
          { bio: null },
          { bio: "" }
        ]
      }
    });
    
    console.log(`Completely blank users (no posts, no avatar, no bio): ${count.toLocaleString()}`);
    return count;
  } catch (error) {
    console.error('Error counting completely blank users:', error);
    return 0;
  }
}

/**
 * Count users by post count ranges
 */
async function countUsersByPostCounts() {
  try {
    // Instead of raw SQL query, we'll use Prisma's native capabilities
    // Get all users with their post counts
    const usersWithPostCounts = await prisma.user.findMany({
      select: {
        id: true,
        _count: {
          select: {
            posts: true
          }
        }
      }
    });
    
    // Calculate the distribution
    const postCountRanges = {
      '0 posts': 0,
      '1-5 posts': 0,
      '6-20 posts': 0,
      '21-50 posts': 0,
      '51-100 posts': 0,
      'More than 100 posts': 0
    };
    
    // Categorize each user
    usersWithPostCounts.forEach(user => {
      const postCount = user._count.posts;
      
      if (postCount === 0) {
        postCountRanges['0 posts']++;
      } else if (postCount >= 1 && postCount <= 5) {
        postCountRanges['1-5 posts']++;
      } else if (postCount >= 6 && postCount <= 20) {
        postCountRanges['6-20 posts']++;
      } else if (postCount >= 21 && postCount <= 50) {
        postCountRanges['21-50 posts']++;
      } else if (postCount >= 51 && postCount <= 100) {
        postCountRanges['51-100 posts']++;
      } else {
        postCountRanges['More than 100 posts']++;
      }
    });
    
    // Convert to array format for consistency with previous implementation
    const userCounts = Object.entries(postCountRanges).map(([post_range, user_count]) => ({
      post_range,
      user_count
    }));
    
    console.log('\nUsers grouped by post count:');
    userCounts.forEach(row => {
      console.log(`${row.post_range}: ${Number(row.user_count).toLocaleString()} users`);
    });
    
    return userCounts;
  } catch (error) {
    console.error('Error counting users by post counts:', error);
    return [];
  }
}

/**
 * Count total users in the system
 */
async function countTotalUsers() {
  try {
    const count = await prisma.user.count();
    console.log(`\nTotal users in the system: ${count.toLocaleString()}`);
    return count;
  } catch (error) {
    console.error('Error counting total users:', error);
    return 0;
  }
}

/**
 * Main function to run the script
 */
async function main() {
  console.log('===============================================');
  console.log('           BLANK USER PROFILE REPORT          ');
  console.log('===============================================\n');
  
  try {
    // Count users in different "blank" categories
    await countUsersWithoutPosts();
    await countUsersWithoutAvatars();
    await countUsersWithoutBios();
    await countCompletelyBlankUsers();
    
    // Count users by post count ranges
    await countUsersByPostCounts();
    
    // Count total users
    const totalUsers = await countTotalUsers();
    
    // Get sample of blank users
    const blankUsersSample = await prisma.user.findMany({
      where: {
        posts: { none: {} },
        avatarUrl: null,
        OR: [
          { bio: null },
          { bio: "" }
        ]
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        createdAt: true
      },
      take: 5
    });
    
    console.log('\nSample of completely blank users:');
    blankUsersSample.forEach(user => {
      console.log(`- ${user.displayName || user.username} (${user.id}), created: ${user.createdAt.toISOString()}`);
    });
    
    console.log('\n===============================================');
    console.log('                 REPORT COMPLETE               ');
    console.log('===============================================');
    
  } catch (error) {
    console.error('Error generating blank user report:', error);
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}

// Run the script
main().then(() => {
  console.log('Script execution completed');
  process.exit(0);
}).catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 