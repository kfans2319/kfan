/**
 * Follow and Like Script (Lite Version)
 * 
 * This script performs two main operations with reasonable numbers:
 * 1. Makes existing blank users follow users with posts (50-100 followers)
 * 2. Makes existing blank users like posts from content creators (30-100 likes)
 * 
 * This version uses moderate numbers that won't overwhelm the database.
 */

const { PrismaClient, Prisma } = require('@prisma/client');

// Initialize Prisma client
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

// Configuration - moderate numbers that won't overwhelm database
const MIN_FOLLOWERS_PER_CREATOR = 50;   // Minimum followers per user
const MAX_FOLLOWERS_PER_CREATOR = 100;  // Maximum followers per user
const MIN_LIKES_PER_POST = 30;          // Minimum likes per post
const MAX_LIKES_PER_POST = 100;         // Maximum likes per post
const BATCH_SIZE = 100;                 // Process in smaller batches to reduce DB load

/**
 * Validate that all required Prisma models exist
 * @returns {Promise<boolean>} Whether all models are available
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
    const postsExist = await safeCount('post', 'Post');
    
    console.log(`Model availability: Follows: ${followsExist}, Likes: ${likesExist}, Posts: ${postsExist}`);
    
    if (!followsExist || !likesExist || !postsExist) {
      console.error('Critical models are missing - cannot proceed');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Get all blank users (users without posts)
 * @param {number} limit Maximum number of users to return
 * @returns {Promise<Array>} Array of user IDs
 */
async function getBlankUsers(limit = 10000) {
  console.log(`Finding blank users (up to ${limit.toLocaleString()})...`);
  
  try {
    const blankUsers = await prisma.user.findMany({
      where: {
        posts: {
          none: {}
        }
      },
      select: {
        id: true
      },
      take: limit
    });
    
    console.log(`Found ${blankUsers.length.toLocaleString()} blank users`);
    return blankUsers.map(user => user.id);
  } catch (error) {
    console.error('Error finding blank users:', error);
    return [];
  }
}

/**
 * Get all users with posts
 * @returns {Promise<Array>} Array of user objects with posts
 */
async function getUsersWithPosts() {
  console.log('Finding users with posts...');
  
  try {
    const usersWithPosts = await prisma.user.findMany({
      where: {
        posts: {
          some: {}
        }
      },
      select: {
        id: true,
        username: true,
        _count: {
          select: {
            posts: true,
            followers: true
          }
        }
      }
    });
    
    console.log(`Found ${usersWithPosts.length} users with posts`);
    return usersWithPosts;
  } catch (error) {
    console.error('Error finding users with posts:', error);
    return [];
  }
}

/**
 * Get all posts from a specific user
 * @param {string} userId User ID
 * @returns {Promise<Array>} Array of post IDs
 */
async function getUserPosts(userId) {
  try {
    const posts = await prisma.post.findMany({
      where: {
        userId
      },
      select: {
        id: true,
        _count: {
          select: {
            likes: true
          }
        }
      }
    });
    
    return posts;
  } catch (error) {
    console.error(`Error getting posts for user ${userId}:`, error);
    return [];
  }
}

/**
 * Create follows in batches
 * @param {string} targetUserId The user to follow
 * @param {number} desiredFollowerCount How many followers to create
 * @param {string[]} blankUserIds Array of blank user IDs to use as followers
 * @returns {Promise<number>} Number of follows created
 */
async function createFollowsForUser(targetUserId, desiredFollowerCount, blankUserIds) {
  console.log(`Creating ${desiredFollowerCount.toLocaleString()} follows for user ${targetUserId}...`);
  
  try {
    // Check existing followers to avoid duplicates
    const existingFollowerCount = await prisma.follow.count({
      where: {
        followingId: targetUserId
      }
    });
    
    console.log(`User already has ${existingFollowerCount.toLocaleString()} followers`);
    
    // Calculate how many more followers needed
    const additionalFollowersNeeded = Math.max(0, desiredFollowerCount - existingFollowerCount);
    
    if (additionalFollowersNeeded <= 0) {
      console.log(`User ${targetUserId} already has enough followers. Skipping.`);
      return existingFollowerCount;
    }
    
    console.log(`Need to add ${additionalFollowersNeeded.toLocaleString()} more followers`);
    
    // Find which users are already following this user
    const existingFollowerIds = await prisma.follow.findMany({
      where: {
        followingId: targetUserId
      },
      select: {
        followerId: true
      }
    });
    
    const existingFollowerIdSet = new Set(existingFollowerIds.map(f => f.followerId));
    
    // Filter out users who are already following
    const availableFollowers = blankUserIds.filter(id => !existingFollowerIdSet.has(id));
    
    if (availableFollowers.length === 0) {
      console.log(`No available users to create followers for user ${targetUserId}`);
      return existingFollowerCount;
    }
    
    // Randomly select users to be followers
    const shuffledUsers = [...availableFollowers].sort(() => 0.5 - Math.random());
    const selectedUsers = shuffledUsers.slice(0, Math.min(additionalFollowersNeeded, shuffledUsers.length));
    
    console.log(`Selected ${selectedUsers.length.toLocaleString()} users to become followers`);
    
    // Split into smaller batches
    let createdFollows = 0;
    
    for (let i = 0; i < selectedUsers.length; i += BATCH_SIZE) {
      const currentBatch = selectedUsers.slice(i, i + BATCH_SIZE);
      
      // Prepare batch data
      const followData = currentBatch.map(followerId => ({
        followerId,
        followingId: targetUserId
      }));
      
      try {
        // Create follows in batch
        const result = await prisma.follow.createMany({
          data: followData,
          skipDuplicates: true,
        });
        
        createdFollows += result.count;
        console.log(`Created ${createdFollows.toLocaleString()}/${selectedUsers.length.toLocaleString()} follows for user ${targetUserId}`);
      } catch (error) {
        console.error(`Error creating follows batch for user ${targetUserId}:`, error);
        console.log('Continuing with next batch...');
      }
      
      // Add a small delay to avoid overwhelming the database
      if (i + BATCH_SIZE < selectedUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    const totalFollowers = existingFollowerCount + createdFollows;
    console.log(`Finished creating follows. User ${targetUserId} now has ${totalFollowers.toLocaleString()} followers`);
    
    // Update follower count in metadata table
    await updateFollowerCountMetadata(targetUserId, totalFollowers);
    
    return totalFollowers;
  } catch (error) {
    console.error(`Error creating follows for user ${targetUserId}:`, error);
    return 0;
  }
}

/**
 * Create likes for a post
 * @param {string} postId Post ID
 * @param {number} desiredLikeCount Desired number of likes
 * @param {string[]} blankUserIds Array of blank user IDs to use as likers
 * @returns {Promise<number>} Number of likes created
 */
async function createLikesForPost(postId, desiredLikeCount, blankUserIds) {
  console.log(`Creating likes for post ${postId}...`);
  
  try {
    // Check existing likes to avoid duplicates
    const existingLikeCount = await prisma.like.count({
      where: {
        postId
      }
    });
    
    console.log(`Post already has ${existingLikeCount.toLocaleString()} likes`);
    
    // Calculate how many more likes needed
    const additionalLikesNeeded = Math.max(0, desiredLikeCount - existingLikeCount);
    
    if (additionalLikesNeeded <= 0) {
      console.log(`Post ${postId} already has enough likes. Skipping.`);
      return existingLikeCount;
    }
    
    console.log(`Need to add ${additionalLikesNeeded.toLocaleString()} more likes`);
    
    // Find which users already liked this post
    const existingLikerIds = await prisma.like.findMany({
      where: {
        postId
      },
      select: {
        userId: true
      }
    });
    
    const existingLikerIdSet = new Set(existingLikerIds.map(like => like.userId));
    
    // Filter out users who already liked the post
    const availableLikers = blankUserIds.filter(id => !existingLikerIdSet.has(id));
    
    if (availableLikers.length === 0) {
      console.log(`No available users to create likes for post ${postId}`);
      return existingLikeCount;
    }
    
    // Randomly select users to be likers
    const shuffledUsers = [...availableLikers].sort(() => 0.5 - Math.random());
    const selectedUsers = shuffledUsers.slice(0, Math.min(additionalLikesNeeded, shuffledUsers.length));
    
    console.log(`Selected ${selectedUsers.length.toLocaleString()} users to like the post`);
    
    // Split into smaller batches
    let createdLikes = 0;
    
    for (let i = 0; i < selectedUsers.length; i += BATCH_SIZE) {
      const currentBatch = selectedUsers.slice(i, i + BATCH_SIZE);
      
      // Prepare batch data
      const likeData = currentBatch.map(userId => ({
        userId,
        postId
      }));
      
      try {
        // Create likes in batch
        const result = await prisma.like.createMany({
          data: likeData,
          skipDuplicates: true,
        });
        
        createdLikes += result.count;
        console.log(`Created ${createdLikes.toLocaleString()}/${selectedUsers.length.toLocaleString()} likes for post ${postId}`);
      } catch (error) {
        console.error(`Error creating likes batch for post ${postId}:`, error);
        console.log('Continuing with next batch...');
      }
      
      // Add a small delay to avoid overwhelming the database
      if (i + BATCH_SIZE < selectedUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    const totalLikes = existingLikeCount + createdLikes;
    console.log(`Finished creating likes. Post ${postId} now has ${totalLikes.toLocaleString()} likes`);
    
    return totalLikes;
  } catch (error) {
    console.error(`Error creating likes for post ${postId}:`, error);
    return 0;
  }
}

/**
 * Create likes for all posts of a user
 * @param {string} userId User ID
 * @param {string[]} blankUserIds Array of blank user IDs to use as likers
 * @returns {Promise<number>} Total number of likes created
 */
async function createLikesForUserPosts(userId, blankUserIds) {
  console.log(`Creating likes for all posts of user ${userId}...`);
  
  try {
    // Get all posts for this user
    const posts = await getUserPosts(userId);
    
    if (posts.length === 0) {
      console.log(`No posts found for user ${userId}. Skipping like creation.`);
      return 0;
    }
    
    console.log(`Found ${posts.length} posts for user ${userId}`);
    
    let totalLikesCreated = 0;
    
    // Process each post
    for (const post of posts) {
      // Random number of likes for this post
      const likeCount = Math.floor(Math.random() * (MAX_LIKES_PER_POST - MIN_LIKES_PER_POST + 1)) + MIN_LIKES_PER_POST;
      
      // Create likes for this post
      const likesCreated = await createLikesForPost(post.id, likeCount, blankUserIds);
      totalLikesCreated += likesCreated;
      
      // Wait a bit between posts to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`Finished creating ${totalLikesCreated.toLocaleString()} likes for user ${userId}'s posts`);
    return totalLikesCreated;
  } catch (error) {
    console.error(`Error creating likes for user ${userId}'s posts:`, error);
    return 0;
  }
}

/**
 * Update follower counts in the metadata table
 * @param {string} userId User ID
 * @param {number} followerCount Follower count
 * @returns {Promise<boolean>} Success status
 */
async function updateFollowerCountMetadata(userId, followerCount) {
  try {
    await prisma.$executeRaw`
      INSERT INTO _followmeta (userid, followercount, createdat, updatedat)
      VALUES (${userId}, ${followerCount}, NOW(), NOW())
      ON CONFLICT (userid) 
      DO UPDATE SET followercount = ${followerCount}, updatedat = NOW()
    `.catch(e => {
      if (e.message.includes('relation "_followmeta" does not exist')) {
        return prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS _followmeta (
            userid TEXT PRIMARY KEY,
            followercount INTEGER NOT NULL,
            createdat TIMESTAMP NOT NULL,
            updatedat TIMESTAMP NOT NULL
          )
        `.then(() => prisma.$executeRaw`
          INSERT INTO _followmeta (userid, followercount, createdat, updatedat)
          VALUES (${userId}, ${followerCount}, NOW(), NOW())
        `);
      }
      throw e;
    });
    
    console.log(`Updated follower count metadata for user ${userId} to ${followerCount.toLocaleString()}`);
    return true;
  } catch (error) {
    console.error(`Error updating follower count metadata for user ${userId}:`, error);
    return false;
  }
}

/**
 * Main function to run the script
 */
async function main() {
  console.log('Starting follow and like process with reasonable numbers...');
  console.log(`Users will have ${MIN_FOLLOWERS_PER_CREATOR}-${MAX_FOLLOWERS_PER_CREATOR} followers`);
  console.log(`Posts will have ${MIN_LIKES_PER_POST}-${MAX_LIKES_PER_POST} likes`);

  try {
    // Validate that all required models exist
    const modelsValid = await validatePrismaModels();
    
    if (!modelsValid) {
      console.error('Cannot proceed due to issues with database models');
      return;
    }
    
    // Get users with posts (content creators)
    const usersWithPosts = await getUsersWithPosts();
    
    if (usersWithPosts.length === 0) {
      console.error('No users with posts found. Cannot proceed.');
      return;
    }
    
    console.log(`Found ${usersWithPosts.length} users with posts who will receive followers and likes`);
    
    // Get blank users (users without posts)
    const blankUserIds = await getBlankUsers();
    
    if (blankUserIds.length === 0) {
      console.error('No blank users found. Cannot proceed.');
      return;
    }
    
    console.log(`Will use ${blankUserIds.length.toLocaleString()} blank users as followers and likers`);
    
    // Process each content creator
    for (const user of usersWithPosts) {
      console.log(`\n======= Processing user ${user.username} (${user.id}) =======`);
      console.log(`User has ${user._count.posts} posts and ${user._count.followers} followers`);
      
      // Generate a random follower count for this user
      const desiredFollowerCount = Math.floor(Math.random() * (MAX_FOLLOWERS_PER_CREATOR - MIN_FOLLOWERS_PER_CREATOR + 1)) + MIN_FOLLOWERS_PER_CREATOR;
      
      try {
        // Create follows
        await createFollowsForUser(user.id, desiredFollowerCount, blankUserIds);
      } catch (error) {
        console.error(`Failed to create follows for user ${user.id}:`, error);
        console.log('Continuing with likes creation...');
      }
      
      try {
        // Create likes for all posts
        await createLikesForUserPosts(user.id, blankUserIds);
      } catch (error) {
        console.error(`Failed to create likes for user ${user.id}:`, error);
      }
      
      // Small delay between processing users
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n----------------------------------------');
    console.log('Follow and like process completed');
    console.log('----------------------------------------');
    console.log(`Processed ${usersWithPosts.length} content creators`);
    console.log(`Each user now has ${MIN_FOLLOWERS_PER_CREATOR}-${MAX_FOLLOWERS_PER_CREATOR} followers`);
    console.log(`Each post now has ${MIN_LIKES_PER_POST}-${MAX_LIKES_PER_POST} likes`);
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