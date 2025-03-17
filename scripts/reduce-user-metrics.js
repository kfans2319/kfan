/**
 * This script reduces the number of followers and post likes for a specific user
 * to help reduce database size and stay under limits.
 * 
 * For user JoJoKinks:
 * - Reduces followers to a random number between 30,000-40,000
 * - Reduces total likes across all posts to a random number between 100,000-300,000
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['warn', 'error']
});

// Configuration
const TARGET_USERNAME = 'JoJoKinks';
// Random follower count between 30,000 and 40,000
const MIN_FOLLOWERS = 30000;
const MAX_FOLLOWERS = 40000;
const TARGET_FOLLOWERS = Math.floor(Math.random() * (MAX_FOLLOWERS - MIN_FOLLOWERS + 1)) + MIN_FOLLOWERS;

// Random total likes between 100,000 and 300,000
const MIN_TOTAL_LIKES = 100000;
const MAX_TOTAL_LIKES = 300000;
const TARGET_TOTAL_LIKES = Math.floor(Math.random() * (MAX_TOTAL_LIKES - MIN_TOTAL_LIKES + 1)) + MIN_TOTAL_LIKES;

const BATCH_SIZE = 1000;          // Number of items to delete in each batch
const SLEEP_BETWEEN_BATCHES = 500; // Milliseconds to sleep between batches

/**
 * Sleep function to add delay between operations
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get user information including followers and total likes
 * @param {string} username - Username to find
 * @returns {Promise<Object>} - User data with counts
 */
async function getUserInfo(username) {
  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        _count: {
          select: {
            followers: true
          }
        }
      }
    });

    if (!user) {
      throw new Error(`User ${username} not found`);
    }

    // Count total likes across all posts
    const totalLikes = await prisma.like.count({
      where: {
        post: {
          userId: user.id
        }
      }
    });

    return {
      ...user,
      totalLikes
    };
  } catch (error) {
    console.error('Error getting user info:', error);
    throw error;
  }
}

/**
 * Reduce the number of followers for a user
 * @param {string} userId - User ID to reduce followers for
 * @param {number} currentFollowers - Current follower count
 * @param {number} targetFollowers - Target follower count
 * @returns {Promise<number>} - Number of followers deleted
 */
async function reduceFollowers(userId, currentFollowers, targetFollowers) {
  // Calculate how many followers to remove
  const followersToRemove = currentFollowers - targetFollowers;
  
  if (followersToRemove <= 0) {
    console.log('No followers need to be removed.');
    return 0;
  }
  
  console.log(`Need to remove ${followersToRemove} followers...`);
  let deleted = 0;
  let batches = 0;
  
  try {
    while (deleted < followersToRemove) {
      // Calculate batch size for this iteration
      const batchSize = Math.min(BATCH_SIZE, followersToRemove - deleted);
      batches++;
      
      // Find followers to delete - select both fields for composite key
      const followers = await prisma.follow.findMany({
        where: {
          followingId: userId
        },
        take: batchSize,
        select: {
          followerId: true,
          followingId: true
        }
      });
      
      if (followers.length === 0) {
        console.log('No more followers found to delete.');
        break;
      }
      
      // Process followers one by one because they use composite keys
      let batchDeleted = 0;
      
      for (const follower of followers) {
        try {
          await prisma.follow.delete({
            where: {
              followerId_followingId: {
                followerId: follower.followerId,
                followingId: follower.followingId
              }
            }
          });
          
          batchDeleted++;
        } catch (error) {
          console.error(`Error deleting follower ${follower.followerId}:`, error.message);
        }
        
        // Small delay between operations
        await sleep(10);
      }
      
      deleted += batchDeleted;
      const percentComplete = ((deleted / followersToRemove) * 100).toFixed(2);
      console.log(`Batch ${batches}: Deleted ${batchDeleted} followers (${deleted}/${followersToRemove} - ${percentComplete}%)`);
      
      // Sleep between batches to avoid overwhelming the database
      await sleep(SLEEP_BETWEEN_BATCHES);
    }
    
    return deleted;
  } catch (error) {
    console.error('Error reducing followers:', error);
    return deleted;
  }
}

/**
 * Reduce the number of likes across all posts for a user
 * @param {string} userId - User ID to reduce likes for
 * @param {number} currentLikes - Current total likes
 * @param {number} targetLikes - Target total likes
 * @returns {Promise<number>} - Number of likes deleted
 */
async function reduceLikes(userId, currentLikes, targetLikes) {
  // Calculate how many likes to remove
  const likesToRemove = currentLikes - targetLikes;
  
  if (likesToRemove <= 0) {
    console.log('No likes need to be removed.');
    return 0;
  }
  
  console.log(`Need to remove ${likesToRemove} likes...`);
  let deleted = 0;
  let batches = 0;
  
  try {
    while (deleted < likesToRemove) {
      // Calculate batch size for this iteration
      const batchSize = Math.min(BATCH_SIZE, likesToRemove - deleted);
      batches++;
      
      // Find user posts first
      const posts = await prisma.post.findMany({
        where: {
          userId: userId
        },
        select: {
          id: true
        },
        take: 100 // Limit to reduce complexity
      });
      
      if (posts.length === 0) {
        console.log('No posts found for user.');
        break;
      }
      
      const postIds = posts.map(p => p.id);
      
      // Find likes for these posts
      const likes = await prisma.like.findMany({
        where: {
          postId: {
            in: postIds
          }
        },
        take: batchSize,
        select: {
          userId: true,
          postId: true
        }
      });
      
      if (likes.length === 0) {
        console.log('No more likes found to delete.');
        break;
      }
      
      // Process likes one by one because they use composite keys
      let batchDeleted = 0;
      
      for (const like of likes) {
        try {
          await prisma.like.delete({
            where: {
              userId_postId: {
                userId: like.userId,
                postId: like.postId
              }
            }
          });
          
          batchDeleted++;
        } catch (error) {
          console.error(`Error deleting like from user ${like.userId} on post ${like.postId}:`, error.message);
        }
        
        // Small delay between operations
        await sleep(10);
      }
      
      deleted += batchDeleted;
      const percentComplete = ((deleted / likesToRemove) * 100).toFixed(2);
      console.log(`Batch ${batches}: Deleted ${batchDeleted} likes (${deleted}/${likesToRemove} - ${percentComplete}%)`);
      
      // Sleep between batches to avoid overwhelming the database
      await sleep(SLEEP_BETWEEN_BATCHES);
    }
    
    return deleted;
  } catch (error) {
    console.error('Error reducing likes:', error);
    return deleted;
  }
}

/**
 * Main function to reduce user metrics
 */
async function reduceUserMetrics() {
  console.log(`Starting metric reduction for user ${TARGET_USERNAME}...`);
  console.log(`Target followers: ${TARGET_FOLLOWERS} (random between ${MIN_FOLLOWERS}-${MAX_FOLLOWERS})`);
  console.log(`Target likes: ${TARGET_TOTAL_LIKES} (random between ${MIN_TOTAL_LIKES}-${MAX_TOTAL_LIKES})`);
  
  try {
    // Get user info with current metrics
    const userInfo = await getUserInfo(TARGET_USERNAME);
    console.log('\nCurrent user metrics:');
    console.log(`- User: ${userInfo.username} (${userInfo.displayName || 'No display name'})`);
    console.log(`- ID: ${userInfo.id}`);
    console.log(`- Followers: ${userInfo._count.followers}`);
    console.log(`- Total Likes: ${userInfo.totalLikes}`);
    
    // Check if reduction is needed
    if (userInfo._count.followers <= TARGET_FOLLOWERS && userInfo.totalLikes <= TARGET_TOTAL_LIKES) {
      console.log('\nNo reduction needed, user is already under the specified limits.');
      return;
    }
    
    console.log('\nBeginning metric reduction...');
    
    // Reduce followers if needed
    if (userInfo._count.followers > TARGET_FOLLOWERS) {
      console.log('\n[STEP 1/2] Reducing followers...');
      const followersDeleted = await reduceFollowers(userInfo.id, userInfo._count.followers, TARGET_FOLLOWERS);
      console.log(`Followers reduction complete. Deleted ${followersDeleted} followers.`);
    } else {
      console.log('\n[STEP 1/2] Follower count already under limit. Skipping.');
    }
    
    // Reduce likes if needed
    if (userInfo.totalLikes > TARGET_TOTAL_LIKES) {
      console.log('\n[STEP 2/2] Reducing likes...');
      const likesDeleted = await reduceLikes(userInfo.id, userInfo.totalLikes, TARGET_TOTAL_LIKES);
      console.log(`Likes reduction complete. Deleted ${likesDeleted} likes.`);
    } else {
      console.log('\n[STEP 2/2] Like count already under limit. Skipping.');
    }
    
    // Get updated metrics
    const updatedUserInfo = await getUserInfo(TARGET_USERNAME);
    console.log('\nUpdated user metrics:');
    console.log(`- Followers: ${updatedUserInfo._count.followers} (target: ${TARGET_FOLLOWERS})`);
    console.log(`- Total Likes: ${updatedUserInfo.totalLikes} (target: ${TARGET_TOTAL_LIKES})`);
    
    console.log('\nMetric reduction complete!');
    
  } catch (error) {
    console.error('Error in metric reduction process:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the main function
reduceUserMetrics()
  .then(() => {
    console.log('\nScript execution completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 