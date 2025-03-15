/**
 * Remove Blank Users Script
 * 
 * This script identifies users without posts and removes a specified number of them.
 * Purpose: Free up database space by removing unused blank user accounts.
 */

const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client with logging to debug issues
const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' }
  ],
});

// Log Prisma errors for debugging
prisma.$on('error', (e) => {
  console.error('Prisma Error:', e);
});

// Configuration
const USERS_TO_REMOVE = 300000; // Number of blank users to remove
const BATCH_SIZE = 100; // Reduced batch size to avoid overwhelming the database

/**
 * Validate that all required Prisma models exist
 * @returns {boolean} Whether all models are available
 */
async function validatePrismaModels() {
  try {
    // Test that the primary models we need are available
    const userCount = await prisma.user.count({ take: 1 });
    console.log(`Database connection verified: Found users table with records`);
    
    // Check other models by trying to safely count them
    const safeCount = async (model, name) => {
      try {
        if (!prisma[model]) {
          console.warn(`Warning: ${name} model not found in Prisma client`);
          return false;
        }
        await prisma[model].count({ take: 1 });
        return true;
      } catch (e) {
        console.warn(`Warning: Error accessing ${name} model:`, e.message);
        return false;
      }
    };
    
    const followsExist = await safeCount('follow', 'Follow');
    const likesExist = await safeCount('like', 'Like');
    const subscriptionTiersExist = await safeCount('subscriptionTier', 'SubscriptionTier');
    const verificationExist = await safeCount('verification', 'Verification');
    
    console.log(`Model availability: Follows: ${followsExist}, Likes: ${likesExist}, SubscriptionTiers: ${subscriptionTiersExist}, Verification: ${verificationExist}`);
    
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Get a specified number of blank users (users without posts)
 * @param {number} limit Maximum number of users to return
 * @returns {Promise<Array>} Array of user IDs
 */
async function getBlankUsers(limit) {
  console.log(`Finding ${limit.toLocaleString()} blank users to remove...`);
  
  try {
    const blankUsers = await prisma.user.findMany({
      where: {
        posts: {
          none: {}
        }
      },
      select: {
        id: true,
        username: true,
        email: true,
        _count: {
          select: {
            followers: true,
            following: true,
            likes: true
          }
        }
      },
      take: limit
    });
    
    console.log(`Found ${blankUsers.length.toLocaleString()} blank users`);
    return blankUsers;
  } catch (error) {
    console.error('Error finding blank users:', error);
    return [];
  }
}

/**
 * Remove dependencies for a user (follows, likes, etc.)
 * @param {string} userId User ID
 * @returns {Promise<boolean>} Success status
 */
async function removeUserDependencies(userId) {
  try {
    // Check if the follow model exists before trying to use it
    if (prisma.follow) {
      // Remove all follows where this user is following someone
      await prisma.follow.deleteMany({
        where: {
          followerId: userId
        }
      });
      
      // Remove all follows where this user is being followed
      await prisma.follow.deleteMany({
        where: {
          followingId: userId
        }
      });
    } else {
      console.log(`Skipping follow cleanup for user ${userId} - model not available`);
    }
    
    // Check if the like model exists before trying to use it
    if (prisma.like) {
      // Remove all likes created by this user
      await prisma.like.deleteMany({
        where: {
          userId
        }
      });
    } else {
      console.log(`Skipping like cleanup for user ${userId} - model not available`);
    }
    
    // Check if the subscription tier model exists before trying to use it
    if (prisma.subscriptionTier) {
      // Remove any subscription tiers created by this user
      await prisma.subscriptionTier.deleteMany({
        where: {
          creatorId: userId
        }
      });
    } else {
      console.log(`Skipping subscription tier cleanup for user ${userId} - model not available`);
    }
    
    // Check if the verification model exists before trying to use it
    if (prisma.verification) {
      // Remove any verification records
      await prisma.verification.deleteMany({
        where: {
          userId
        }
      });
    } else {
      console.log(`Skipping verification cleanup for user ${userId} - model not available`);
    }
    
    // Remove follower count metadata using raw SQL for compatibility
    try {
      await prisma.$executeRaw`
        DELETE FROM _followmeta 
        WHERE userid = ${userId}
      `;
    } catch (e) {
      // Ignore if _followmeta table doesn't exist
      if (!e.message.includes('relation "_followmeta" does not exist')) {
        console.warn(`Warning: Error removing follow metadata for user ${userId}:`, e.message);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error removing dependencies for user ${userId}:`, error);
    return false;
  }
}

/**
 * Delete a batch of users
 * @param {Array} users Array of user objects to delete
 * @returns {Promise<number>} Number of users successfully deleted
 */
async function deleteUserBatch(users) {
  let deletedCount = 0;
  
  for (const user of users) {
    try {
      // Remove all related records first
      const dependenciesRemoved = await removeUserDependencies(user.id);
      
      if (!dependenciesRemoved) {
        console.warn(`Skipping deletion of user ${user.id} due to dependency removal failure`);
        continue;
      }
      
      // Now delete the user
      await prisma.user.delete({
        where: {
          id: user.id
        }
      });
      
      deletedCount++;
      
      if (deletedCount % 50 === 0) {
        console.log(`Deleted ${deletedCount} users so far in current batch`);
      }
    } catch (error) {
      console.error(`Error deleting user ${user.id}:`, error);
    }
  }
  
  return deletedCount;
}

/**
 * Main function to run the script
 */
async function main() {
  console.log(`Starting removal of ${USERS_TO_REMOVE.toLocaleString()} blank users...`);

  try {
    // Validate that all Prisma models exist
    const modelsValid = await validatePrismaModels();
    
    if (!modelsValid) {
      console.error('Cannot proceed due to issues with database models');
      return;
    }
    
    // Get the blank users to remove
    const blankUsers = await getBlankUsers(USERS_TO_REMOVE);
    
    if (blankUsers.length === 0) {
      console.error('No blank users found. Nothing to remove.');
      return;
    }
    
    console.log(`Found ${blankUsers.length.toLocaleString()} blank users to remove`);
    
    // Group by follows/likes to optimize deletion
    const usersWithStats = blankUsers.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      totalRelations: user._count.followers + user._count.following + user._count.likes
    }));
    
    // Sort by number of relations (fewer first for faster processing)
    usersWithStats.sort((a, b) => a.totalRelations - b.totalRelations);
    
    console.log('Sorted users by relation count (users with fewer relations will be deleted first)');
    
    // Process in batches
    let totalDeleted = 0;
    
    for (let i = 0; i < usersWithStats.length; i += BATCH_SIZE) {
      const currentBatch = usersWithStats.slice(i, i + BATCH_SIZE);
      
      console.log(`\nProcessing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(usersWithStats.length/BATCH_SIZE)} (${currentBatch.length} users)`);
      
      const batchStart = Date.now();
      const deletedInBatch = await deleteUserBatch(currentBatch);
      const batchDuration = (Date.now() - batchStart) / 1000;
      
      totalDeleted += deletedInBatch;
      
      console.log(`Batch completed in ${batchDuration.toFixed(2)} seconds`);
      console.log(`Deleted ${deletedInBatch} users in this batch`);
      console.log(`Total deleted so far: ${totalDeleted.toLocaleString()}`);
      
      // If we didn't delete all users in the batch, something is wrong
      if (deletedInBatch < currentBatch.length) {
        console.warn(`Warning: Only deleted ${deletedInBatch} out of ${currentBatch.length} users in this batch`);
      }
      
      // Add a delay between batches to reduce database load
      if (i + BATCH_SIZE < usersWithStats.length) {
        console.log('Pausing before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n----------------------------------------');
    console.log(`Blank user removal completed`);
    console.log('----------------------------------------');
    console.log(`Successfully removed ${totalDeleted.toLocaleString()} blank users out of ${blankUsers.length.toLocaleString()} targeted`);
    
    if (totalDeleted < blankUsers.length) {
      console.warn(`Warning: ${blankUsers.length - totalDeleted} users could not be removed due to errors`);
    }
  } catch (error) {
    console.error('Error in main process:', error);
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}

// Run the script
main().then(() => {
  console.log('Script execution completed');
}).catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 