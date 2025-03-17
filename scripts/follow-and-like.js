/**
 * Follow and Like Script
 * 
 * This script performs two main operations:
 * 1. Makes existing blank users follow the user "JoJoKinks"
 * 2. Makes existing blank users like posts from JoJoKinks
 * 
 * This is a targeted script that doesn't create new users, but uses existing ones.
 */

const { PrismaClient, Prisma } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient();

// Configuration
const MIN_FOLLOWERS_PER_USER = 40;
const MAX_FOLLOWERS_PER_USER = 500;
const MIN_LIKES_PER_POST = 20;
const MAX_LIKES_PER_POST = 100;
const BATCH_SIZE = 5000; // Process in batches of 5000 to avoid memory issues

/**
 * Get all blank users (users without posts)
 * @param {number} limit Maximum number of users to return
 * @returns {Promise<Array>} Array of user IDs
 */
async function getBlankUsers(limit = 1000000) {
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
 * Get all users in the database
 * @returns {Promise<Array>} Array of all users
 */
async function getAllUsers() {
  console.log('Getting all users...');
  
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        _count: {
          select: {
            posts: true
          }
        }
      }
    });
    
    console.log(`Found ${users.length} total users`);
    return users;
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
}

/**
 * Get the target user (JoJoKinks)
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getTargetUser() {
  console.log(`Finding target user ${TARGET_USERNAME}...`);
  
  try {
    const targetUser = await prisma.user.findFirst({
      where: {
        username: TARGET_USERNAME
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
    
    if (!targetUser) {
      console.error(`User ${TARGET_USERNAME} not found!`);
      return null;
    }
    
    console.log(`Found target user ${targetUser.username} (${targetUser.id})`);
    console.log(`User has ${targetUser._count.posts} posts and ${targetUser._count.followers} followers`);
    return targetUser;
  } catch (error) {
    console.error(`Error finding target user ${TARGET_USERNAME}:`, error);
    return null;
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
      
      // Create follows in batch
      const result = await prisma.follow.createMany({
        data: followData,
        skipDuplicates: true,
      });
      
      createdFollows += result.count;
      console.log(`Created ${createdFollows.toLocaleString()}/${selectedUsers.length.toLocaleString()} follows for user ${targetUserId}`);
      
      // Add a small delay to avoid overwhelming the database
      if (i + BATCH_SIZE < selectedUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
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
      
      // Create likes in batch
      const result = await prisma.like.createMany({
        data: likeData,
        skipDuplicates: true,
      });
      
      createdLikes += result.count;
      console.log(`Created ${createdLikes.toLocaleString()}/${selectedUsers.length.toLocaleString()} likes for post ${postId}`);
      
      // Add a small delay to avoid overwhelming the database
      if (i + BATCH_SIZE < selectedUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
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
  console.log('Starting follow and like process for all users...');

  try {
    // Get all users
    const allUsers = await getAllUsers();
    
    if (allUsers.length === 0) {
      console.error('No users found. Cannot proceed.');
      return;
    }
    
    console.log(`Will create follows and likes for ${allUsers.length} users`);
    
    // Get blank users (users without posts)
    const blankUserIds = await getBlankUsers();
    
    if (blankUserIds.length === 0) {
      console.error('No blank users found. Cannot proceed.');
      return;
    }
    
    console.log(`Will use ${blankUserIds.length.toLocaleString()} blank users as followers and likers`);
    
    // Process each user
    for (const user of allUsers) {
      console.log(`\n======= Processing user ${user.id} =======`);
      
      // Generate a random follower count for this user
      const desiredFollowerCount = Math.floor(Math.random() * (MAX_FOLLOWERS_PER_USER - MIN_FOLLOWERS_PER_USER + 1)) + MIN_FOLLOWERS_PER_USER;
      
      // Create follows
      await createFollowsForUser(user.id, desiredFollowerCount, blankUserIds);
      
      // Create likes for all posts
      await createLikesForUserPosts(user.id, blankUserIds);
      
      // Small delay between processing users
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n----------------------------------------');
    console.log('Follow and like process completed for all users');
    console.log('----------------------------------------');
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