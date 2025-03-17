/**
 * Database Size Analyzer
 * 
 * This script analyzes what's taking up the most space in your database.
 * It counts records in all major tables, identifies the users with the most content,
 * and looks for potential issues that might be causing unexpected database growth.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['warn', 'error']
});

// Configuration
const TOP_USERS_COUNT = 10;  // Number of top users to show
const VERBOSE = true;        // Whether to show detailed information

/**
 * Main function to analyze database size
 */
async function analyzeDatabaseSize() {
  console.log('Starting database size analysis...');
  console.log('--------------------------------\n');

  try {
    // 1. Count records in all major tables
    await countAllTables();

    // 2. Find users with the most content
    await findLargestUsers();

    // 3. Check for orphaned records or potential issues
    await checkForOrphanedData();

    // 4. Analyze data distribution by creation date
    await analyzeDataByDate();

    console.log('\nDatabase analysis complete!');
    console.log('\nPossible reasons for database growth during deletion:');
    console.log('1. Transaction logs and WAL (Write-Ahead Logging) files may be growing');
    console.log('2. Database might need vacuuming/compaction after large deletes');
    console.log('3. Backup or snapshot systems may be retaining deleted data');
    console.log('4. Indexes might be bloated and need rebuilding');
    console.log('5. For PostgreSQL, autovacuum might not be keeping up with changes');

  } catch (error) {
    console.error('Error during database analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Count records in all major tables and estimate their size
 */
async function countAllTables() {
  console.log('RECORD COUNTS BY TABLE');
  console.log('----------------------');

  // Define tables to check with estimated bytes per record
  // These are rough estimates and will vary based on actual data
  const tables = [
    { name: 'User', bytesPerRecord: 2000 },
    { name: 'Post', bytesPerRecord: 1500 },
    { name: 'Comment', bytesPerRecord: 500 },
    { name: 'Like', bytesPerRecord: 100 },
    { name: 'Follow', bytesPerRecord: 100 },
    { name: 'Bookmark', bytesPerRecord: 100 },
    { name: 'Attachment', bytesPerRecord: 5000 },
    { name: 'SubscriptionTier', bytesPerRecord: 500 },
    { name: 'Subscription', bytesPerRecord: 300 },
    { name: 'PayoutRequest', bytesPerRecord: 400 },
    { name: 'BankInformation', bytesPerRecord: 800 },
    { name: 'Notification', bytesPerRecord: 400 },
    { name: 'Session', bytesPerRecord: 300 }
  ];

  // Define some helper functions for formatting
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  let totalSize = 0;
  const results = [];

  // Count records for each table
  for (const table of tables) {
    try {
      // Use dynamic model access based on table name
      const count = await prisma[table.name.charAt(0).toLowerCase() + table.name.slice(1)].count();
      const estimatedSize = count * table.bytesPerRecord;
      totalSize += estimatedSize;
      
      results.push({
        name: table.name,
        count,
        estimatedSize,
        formattedSize: formatSize(estimatedSize)
      });
    } catch (error) {
      console.warn(`Could not count ${table.name}: ${error.message}`);
    }
  }

  // Sort by size (largest first) and display
  results.sort((a, b) => b.estimatedSize - a.estimatedSize);
  
  for (const result of results) {
    const percentOfTotal = (result.estimatedSize / totalSize * 100).toFixed(2);
    console.log(`${result.name.padEnd(20)} ${formatNumber(result.count).padStart(12)} records | ${result.formattedSize.padStart(10)} | ${percentOfTotal.padStart(5)}%`);
  }

  console.log('\nTotal estimated data size:', formatSize(totalSize));
  console.log('Note: These estimates exclude indexes, which can add 20-50% more space');
  console.log('      They also exclude transaction logs, WAL files, and other DB overhead\n');
}

/**
 * Find users with the most content
 */
async function findLargestUsers() {
  console.log('\nTOP USERS BY CONTENT');
  console.log('-------------------');

  try {
    // Get users with the most posts
    const usersWithMostContent = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
            likes: true,
            comments: true
          }
        }
      },
      orderBy: {
        posts: { _count: 'desc' }
      },
      take: TOP_USERS_COUNT
    });

    // For each user, estimate their total content size
    for (let i = 0; i < usersWithMostContent.length; i++) {
      const user = usersWithMostContent[i];
      
      // Count attachments (media) for this user
      const attachmentCount = await prisma.attachment.count({
        where: {
          post: {
            userId: user.id
          }
        }
      });

      // Calculate estimates
      // Rough estimates in bytes for each content type
      const postSize = user._count.posts * 1500;
      const followerSize = user._count.followers * 100;
      const followingSize = user._count.following * 100;
      const likeSize = user._count.likes * 100;
      const commentSize = user._count.comments * 500;
      const attachmentSize = attachmentCount * 5000;
      
      const totalSize = postSize + followerSize + followingSize + likeSize + commentSize + attachmentSize;
      
      // Format for display
      const formatSize = (bytes) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      };

      console.log(`${i+1}. ${user.username}`);
      console.log(`   Total Size: ~${formatSize(totalSize)}`);
      console.log(`   Posts: ${user._count.posts}, Attachments: ${attachmentCount}`);
      console.log(`   Social: ${user._count.followers} followers, ${user._count.following} following, ${user._count.likes} likes, ${user._count.comments} comments`);
      
      if (VERBOSE) {
        console.log(`   Breakdown:`);
        console.log(`     - Posts: ${formatSize(postSize)}`);
        console.log(`     - Attachments: ${formatSize(attachmentSize)}`);
        console.log(`     - Followers: ${formatSize(followerSize)}`);
        console.log(`     - Following: ${formatSize(followingSize)}`);
        console.log(`     - Likes: ${formatSize(likeSize)}`);
        console.log(`     - Comments: ${formatSize(commentSize)}`);
      }
      
      console.log('');
    }
  } catch (error) {
    console.error('Error finding largest users:', error);
  }
}

/**
 * Check for orphaned records or potential issues
 */
async function checkForOrphanedData() {
  console.log('\nCHECKING FOR POTENTIAL ISSUES');
  console.log('----------------------------');

  try {
    // Check for orphaned attachments (attachments without a valid post)
    const orphanedAttachmentCount = await prisma.attachment.count({
      where: {
        post: {
          is: null
        }
      }
    });
    console.log(`Orphaned attachments: ${orphanedAttachmentCount}`);

    // Check for orphaned comments (comments without a valid post)
    const orphanedCommentCount = await prisma.comment.count({
      where: {
        post: {
          is: null
        }
      }
    });
    console.log(`Orphaned comments: ${orphanedCommentCount}`);

    // Check for orphaned likes (likes without a valid post)
    const orphanedLikeCount = await prisma.like.count({
      where: {
        post: {
          is: null
        }
      }
    });
    console.log(`Orphaned likes: ${orphanedLikeCount}`);

    // Check for orphaned follows (follows with missing users)
    const orphanedFollowCount = await prisma.follow.count({
      where: {
        OR: [
          {
            follower: {
              is: null
            }
          },
          {
            following: {
              is: null
            }
          }
        ]
      }
    });
    console.log(`Orphaned follows: ${orphanedFollowCount}`);

    // Check for orphaned subscriptions (subscriptions without valid users or tiers)
    const orphanedSubscriptionCount = await prisma.subscription.count({
      where: {
        OR: [
          {
            subscriber: {
              is: null
            }
          },
          {
            tier: {
              is: null
            }
          }
        ]
      }
    });
    console.log(`Orphaned subscriptions: ${orphanedSubscriptionCount}`);

    // Check for users with a high number of sessions
    const usersWithManySessions = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        _count: {
          select: {
            sessions: true
          }
        }
      },
      where: {
        sessions: {
          some: {}
        }
      },
      orderBy: {
        sessions: { _count: 'desc' }
      },
      take: 5
    });

    if (usersWithManySessions.length > 0) {
      console.log('\nUsers with many sessions:');
      for (const user of usersWithManySessions) {
        console.log(`  ${user.username}: ${user._count.sessions} sessions`);
      }
    }

    // Check for soft-deleted content still in the database
    try {
      const softDeletedPostCount = await prisma.post.count({
        where: {
          deletedAt: {
            not: null
          }
        }
      });
      console.log(`Soft-deleted posts: ${softDeletedPostCount}`);
    } catch (error) {
      // Ignore if deletedAt field doesn't exist
      if (!error.message.includes('Unknown field')) {
        console.warn('Error checking soft-deleted posts:', error.message);
      }
    }

  } catch (error) {
    console.error('Error checking for orphaned data:', error);
  }
}

/**
 * Analyze data distribution by creation date
 */
async function analyzeDataByDate() {
  console.log('\nDATA DISTRIBUTION BY CREATION DATE');
  console.log('--------------------------------');

  try {
    // Define time periods to check
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    // Count posts by age
    const recentPosts = await prisma.post.count({
      where: {
        createdAt: {
          gte: oneWeekAgo
        }
      }
    });

    const monthPosts = await prisma.post.count({
      where: {
        createdAt: {
          gte: oneMonthAgo,
          lt: oneWeekAgo
        }
      }
    });

    const sixMonthPosts = await prisma.post.count({
      where: {
        createdAt: {
          gte: sixMonthsAgo,
          lt: oneMonthAgo
        }
      }
    });

    const olderPosts = await prisma.post.count({
      where: {
        createdAt: {
          lt: sixMonthsAgo
        }
      }
    });

    const totalPosts = recentPosts + monthPosts + sixMonthPosts + olderPosts;

    // Display age distribution
    console.log('Posts by age:');
    console.log(`  Last 7 days: ${recentPosts} (${percentage(recentPosts, totalPosts)}%)`);
    console.log(`  Last 8-30 days: ${monthPosts} (${percentage(monthPosts, totalPosts)}%)`);
    console.log(`  Last 31-180 days: ${sixMonthPosts} (${percentage(sixMonthPosts, totalPosts)}%)`);
    console.log(`  Older than 180 days: ${olderPosts} (${percentage(olderPosts, totalPosts)}%)`);

    // Now do the same for users
    const recentUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: oneWeekAgo
        }
      }
    });

    const monthUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: oneMonthAgo,
          lt: oneWeekAgo
        }
      }
    });

    const sixMonthUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: sixMonthsAgo,
          lt: oneMonthAgo
        }
      }
    });

    const olderUsers = await prisma.user.count({
      where: {
        createdAt: {
          lt: sixMonthsAgo
        }
      }
    });

    const totalUsers = recentUsers + monthUsers + sixMonthUsers + olderUsers;

    console.log('\nUsers by age:');
    console.log(`  Last 7 days: ${recentUsers} (${percentage(recentUsers, totalUsers)}%)`);
    console.log(`  Last 8-30 days: ${monthUsers} (${percentage(monthUsers, totalUsers)}%)`);
    console.log(`  Last 31-180 days: ${sixMonthUsers} (${percentage(sixMonthUsers, totalUsers)}%)`);
    console.log(`  Older than 180 days: ${olderUsers} (${percentage(olderUsers, totalUsers)}%)`);

  } catch (error) {
    console.error('Error analyzing data by date:', error);
  }
}

/**
 * Calculate percentage and format
 */
function percentage(part, total) {
  if (total === 0) return '0.00';
  return (part / total * 100).toFixed(2);
}

// Execute the main function
analyzeDatabaseSize()
  .then(() => {
    console.log('\nScript execution completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 