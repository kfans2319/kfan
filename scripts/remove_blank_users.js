/**
 * Remove Blank Users Script
 * 
 * This script safely removes blank users from the database.
 * Blank users are defined as users with no posts, no avatar, and no bio.
 * 
 * Usage:
 * node scripts/remove_blank_users.js [--dry-run] [--limit=NUMBER] [--batch-size=NUMBER]
 * 
 * Options:
 *   --dry-run       Run the script without actually deleting users (default: false)
 *   --limit=NUMBER  Limit the number of users to delete (default: no limit)
 *   --batch-size=NUMBER  Number of users to process in each batch (default: 100)
 */

const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client with logging
const prisma = new PrismaClient({
  log: ['error', 'warn']
});

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));

const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;

// Maximum number of retry attempts for database operations
const MAX_RETRIES = 3;
// Small delay between retries (in milliseconds)
const RETRY_DELAY = 1000;

/**
 * Sleep function for delay
 * @param {number} ms Milliseconds to sleep
 * @returns {Promise}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Find blank users
 * @param {number} skip Number of users to skip
 * @param {number} take Number of users to take
 * @returns {Promise<Array>} Array of blank user objects
 */
async function findBlankUsers(skip, take) {
  try {
    const blankUsers = await prisma.user.findMany({
      where: {
        posts: {
          none: {}
        },
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
      skip,
      take
    });
    
    return blankUsers;
  } catch (error) {
    console.error('Error finding blank users:', error);
    return [];
  }
}

/**
 * Count total blank users
 * @returns {Promise<number>} Count of blank users
 */
async function countBlankUsers() {
  let retries = 0;
  while (retries <= MAX_RETRIES) {
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
      
      return count;
    } catch (error) {
      retries++;
      console.error(`Error counting blank users (attempt ${retries}/${MAX_RETRIES}):`, error);
      if (retries <= MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY);
      } else {
        return 0;
      }
    }
  }
}

/**
 * Delete related data for a user with separate transactions for each relation type
 * @param {string} userId User ID to delete related data for
 * @returns {Promise<boolean>} Success status
 */
async function deleteRelatedData(userId) {
  if (dryRun) {
    return true;
  }
  
  try {
    // Delete follows (separate transaction)
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: userId },
          { followingId: userId }
        ]
      }
    });
    
    // Small delay to avoid overwhelming the database
    await sleep(10);
    
    // Delete likes (separate transaction)
    await prisma.like.deleteMany({
      where: { userId }
    });
    
    await sleep(10);
    
    // Delete bookmarks (separate transaction)
    await prisma.bookmark.deleteMany({
      where: { userId }
    });
    
    await sleep(10);
    
    // Delete comments (separate transaction)
    await prisma.comment.deleteMany({
      where: { userId }
    });
    
    await sleep(10);
    
    // Find post IDs for attachments
    const userPosts = await prisma.post.findMany({
      where: { userId },
      select: { id: true }
    });
    
    if (userPosts.length > 0) {
      const postIds = userPosts.map(post => post.id);
      
      // Delete attachments for user posts (separate transaction)
      await prisma.attachment.deleteMany({
        where: {
          postId: {
            in: postIds
          }
        }
      });
      
      await sleep(10);
    }
    
    // Delete posts (separate transaction)
    await prisma.post.deleteMany({
      where: { userId }
    });
    
    await sleep(10);
    
    // Handle subscription tiers and related subscriptions
    const userTiers = await prisma.subscriptionTier.findMany({
      where: { creatorId: userId },
      select: { id: true }
    });
    
    if (userTiers.length > 0) {
      const tierIds = userTiers.map(tier => tier.id);
      
      // Delete subscriptions to user tiers (separate transaction)
      await prisma.subscription.deleteMany({
        where: {
          tierId: {
            in: tierIds
          }
        }
      });
      
      await sleep(10);
      
      // Delete subscription tiers (separate transaction)
      await prisma.subscriptionTier.deleteMany({
        where: { creatorId: userId }
      });
      
      await sleep(10);
    }
    
    // Delete user subscriptions (separate transaction)
    await prisma.subscription.deleteMany({
      where: { subscriberId: userId }
    });
    
    await sleep(10);
    
    // Delete metadata records (using try-catch for optional table)
    try {
      // Use raw query as a separate operation
      await prisma.$executeRaw`DELETE FROM "_followmeta" WHERE userid = ${userId}`;
    } catch (error) {
      // Ignore if table doesn't exist
      if (!error.message.includes('relation "_followmeta" does not exist')) {
        console.warn(`Warning: Could not delete follow metadata for user ${userId}:`, error.message);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error deleting related data for user ${userId}:`, error);
    return false;
  }
}

/**
 * Delete a user after their related data has been deleted
 * @param {string} userId User ID to delete
 * @returns {Promise<boolean>} Success status
 */
async function deleteUserRecord(userId) {
  if (dryRun) {
    return true;
  }
  
  let retries = 0;
  while (retries <= MAX_RETRIES) {
    try {
      // Delete the user record directly
      await prisma.user.delete({
        where: { id: userId }
      });
      
      return true;
    } catch (error) {
      retries++;
      console.error(`Error deleting user ${userId} (attempt ${retries}/${MAX_RETRIES}):`, error);
      if (retries <= MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY);
      } else {
        return false;
      }
    }
  }
  
  return false;
}

/**
 * Delete a user and all related data
 * @param {string} userId User ID to delete
 * @returns {Promise<boolean>} Success status
 */
async function deleteUser(userId) {
  if (dryRun) {
    // Dry run, don't actually delete
    return true;
  }
  
  try {
    // First delete all related data
    const relatedDataDeleted = await deleteRelatedData(userId);
    
    if (!relatedDataDeleted) {
      console.warn(`Warning: Could not delete all related data for user ${userId}`);
      // Continue anyway to try deleting the user
    }
    
    // Then delete the user record
    const userDeleted = await deleteUserRecord(userId);
    
    return userDeleted;
  } catch (error) {
    console.error(`Error deleting user ${userId}:`, error);
    return false;
  }
}

/**
 * Main function to remove blank users
 */
async function removeBlankUsers() {
  console.log('===============================================');
  console.log('           BLANK USER REMOVAL TOOL            ');
  console.log('===============================================\n');
  
  if (dryRun) {
    console.log('DRY RUN MODE: No users will actually be deleted\n');
  }
  
  if (limit) {
    console.log(`User deletion limited to ${limit.toLocaleString()} users\n`);
  }
  
  try {
    // Count total blank users
    const totalBlankUsers = await countBlankUsers();
    console.log(`Found ${totalBlankUsers.toLocaleString()} blank users in the database`);
    
    if (totalBlankUsers === 0) {
      console.log('No blank users to remove. Exiting.');
      return;
    }
    
    // Calculate how many users to process
    const usersToProcess = limit ? Math.min(limit, totalBlankUsers) : totalBlankUsers;
    console.log(`Will process ${usersToProcess.toLocaleString()} blank users in batches of ${batchSize}`);
    
    // Confirm before proceeding
    if (!dryRun) {
      console.log(`\n⚠️  WARNING: This will permanently delete ${usersToProcess.toLocaleString()} users and all their related data!`);
      console.log('Run with --dry-run to test without deleting.\n');
      // In a real application, you would add user confirmation here
    }
    
    // Process users in batches
    let processedCount = 0;
    let deletedCount = 0;
    let skip = 0;
    let batchNum = 0;
    
    console.log('\nStarting user processing...');
    
    while (processedCount < usersToProcess) {
      batchNum++;
      
      // Calculate batch size for this iteration
      const currentBatchSize = Math.min(batchSize, usersToProcess - processedCount);
      
      // Get a batch of blank users
      const users = await findBlankUsers(skip, currentBatchSize);
      
      if (users.length === 0) {
        console.log('No more blank users found. Exiting.');
        break;
      }
      
      console.log(`\nProcessing batch ${batchNum} (${users.length} users)...`);
      
      // Process each user in the batch
      let batchDeletedCount = 0;
      
      for (const user of users) {
        processedCount++;
        
        // Log user info
        const userDesc = `User: ${user.displayName || user.username} (${user.id})`;
        
        // Delete the user
        const success = await deleteUser(user.id);
        
        if (success) {
          deletedCount++;
          batchDeletedCount++;
          console.log(`✅ [${processedCount}/${usersToProcess}] Deleted ${userDesc}`);
        } else {
          console.log(`❌ [${processedCount}/${usersToProcess}] Failed to delete ${userDesc}`);
        }
        
        // Add a small delay between user deletions
        await sleep(100);
      }
      
      // Log batch results
      const percentComplete = ((processedCount / usersToProcess) * 100).toFixed(2);
      console.log(`\nBatch ${batchNum} complete: Deleted ${batchDeletedCount}/${users.length} users`);
      console.log(`Progress: ${processedCount.toLocaleString()}/${usersToProcess.toLocaleString()} users (${percentComplete}%)`);
      
      // Update skip value for next batch
      skip += users.length;
      
      // Add a small delay between batches
      await sleep(1000);
    }
    
    // Log final results
    console.log('\n===============================================');
    console.log('               REMOVAL COMPLETE                ');
    console.log('===============================================');
    console.log(`Processed: ${processedCount.toLocaleString()} users`);
    console.log(`${dryRun ? 'Would have deleted' : 'Deleted'}: ${deletedCount.toLocaleString()} users`);
    console.log(`Remaining blank users: ${(totalBlankUsers - deletedCount).toLocaleString()}`);
    
  } catch (error) {
    console.error('Error removing blank users:', error);
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}

// Run the main function
removeBlankUsers().then(() => {
  console.log('Script execution completed');
  process.exit(0);
}).catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 