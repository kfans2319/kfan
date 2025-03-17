/**
 * Blank User Generator Script
 * 
 * This script generates one million blank user profiles that:
 * 1. Have random usernames and emails
 * 2. All share the same password: Trigun1!
 * 3. Follow all users that have posts
 * 4. Generate likes on posts with random distributions
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
const { hash } = require('@node-rs/argon2');
const { generateIdFromEntropySize } = require('lucia');
const crypto = require('crypto');

// Initialize Prisma client
const prisma = new PrismaClient();

// Configuration
const USER_PASSWORD = 'Trigun1!';
const NUM_USERS = 70000;
const BATCH_SIZE = 1000;
const MIN_FOLLOWERS = 40;
const MAX_FOLLOWERS = 500;
const MIN_LIKES = 20;
const MAX_LIKES = 100;

// Arrays to store adjectives and nouns for username generation
const adjectives = [
  'happy', 'brave', 'creative', 'swift', 'clever', 'bright', 'mighty', 'calm',
  'wise', 'great', 'bold', 'fancy', 'magical', 'super', 'jolly', 'wild',
  'fierce', 'gentle', 'smart', 'kind', 'smooth', 'shiny', 'quick', 'silent'
];

const nouns = [
  'tiger', 'dragon', 'panda', 'fox', 'wolf', 'eagle', 'lion', 'dolphin',
  'hero', 'ninja', 'wizard', 'knight', 'runner', 'dancer', 'gamer', 'coder',
  'writer', 'artist', 'ranger', 'pilot', 'singer', 'agent', 'racer', 'chef'
];

/**
 * Generate a random username
 * @returns {string} A random username
 */
function generateRandomUsername() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomSuffix = Math.floor(Math.random() * 10000);
  return `${adjective}${noun}${randomSuffix}`;
}

/**
 * Generate a random email for a username
 * @param {string} username The username
 * @returns {string} A random email
 */
function generateRandomEmail(username) {
  const sanitizedUsername = username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const randomSuffix = Math.floor(Math.random() * 10000);
  const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'protonmail.com'];
  const randomDomain = domains[Math.floor(Math.random() * domains.length)];
  return `${sanitizedUsername}${randomSuffix}@${randomDomain}`;
}

/**
 * Create a batch of blank users
 * @param {number} batchNumber The batch number
 * @param {number} batchSize The number of users to create in this batch
 * @returns {Promise<string[]>} Array of created user IDs
 */
async function createUserBatch(batchNumber, batchSize) {
  console.log(`Creating batch ${batchNumber} (${batchSize} users)...`);
  
  const startIndex = (batchNumber - 1) * batchSize;
  const userBatch = [];
  
  // Hash the password once outside the loop (same for all users)
  const passwordHash = await hash(USER_PASSWORD, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
  
  // Generate a random join date range between January 1, 2023 and now
  const startDate = new Date('2023-01-01T00:00:00Z').getTime();
  const now = new Date().getTime();
  
  // Prepare batch creation
  for (let i = 0; i < batchSize; i++) {
    const username = generateRandomUsername();
    const email = generateRandomEmail(username);
    const userId = generateIdFromEntropySize(10);
    
    // Generate a random join date
    const randomTimestamp = startDate + Math.random() * (now - startDate);
    const createdAt = new Date(randomTimestamp);
    
    userBatch.push({
      id: userId,
      username,
      displayName: username,
      email,
      passwordHash,
      isVerified: true,
      verificationStatus: 'APPROVED',
      createdAt,
    });
  }
  
  // Create users in a single batch operation
  try {
    await prisma.user.createMany({
      data: userBatch,
      skipDuplicates: true,
    });
    
    console.log(`Successfully created batch ${batchNumber} with ${batchSize} users`);
    
    // Return the user IDs for potential further operations
    return userBatch.map(user => user.id);
  } catch (error) {
    console.error(`Error creating user batch ${batchNumber}:`, error);
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
        id: true
      }
    });
    
    return posts.map(post => post.id);
  } catch (error) {
    console.error(`Error getting posts for user ${userId}:`, error);
    return [];
  }
}

/**
 * Execute a raw SQL query to efficiently create follows
 * @param {string} targetUserId The user to follow
 * @param {number} followerCount How many followers to create
 * @param {string[]} blankUserIds Array of blank user IDs to use as followers
 * @returns {Promise<number>} Number of follows created
 */
async function createFollowsForUser(targetUserId, followerCount, blankUserIds) {
  console.log(`Creating ${followerCount.toLocaleString()} follows for user ${targetUserId}...`);
  
  try {
    // Random selection of blank users to be followers
    const shuffledUsers = [...blankUserIds].sort(() => 0.5 - Math.random());
    const selectedUsers = shuffledUsers.slice(0, followerCount);
    
    // Split into smaller batches to avoid overwhelming the database
    const followBatchSize = 5000;
    let createdFollows = 0;
    
    for (let i = 0; i < selectedUsers.length; i += followBatchSize) {
      const currentBatch = selectedUsers.slice(i, i + followBatchSize);
      
      // Prepare batch data
      const followData = currentBatch.map(followerId => ({
        followerId,
        followingId: targetUserId
      }));
      
      // Create follows in batch
      await prisma.follow.createMany({
        data: followData,
        skipDuplicates: true,
      });
      
      createdFollows += currentBatch.length;
      console.log(`Created ${createdFollows.toLocaleString()}/${followerCount.toLocaleString()} follows for user ${targetUserId}`);
      
      // Add a small delay to avoid overwhelming the database
      if (i + followBatchSize < selectedUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Finished creating ${createdFollows.toLocaleString()} follows for user ${targetUserId}`);
    return createdFollows;
  } catch (error) {
    console.error(`Error creating follows for user ${targetUserId}:`, error);
    return 0;
  }
}

/**
 * Create likes on posts for a user
 * @param {string} userId User ID who owns the posts
 * @param {string[]} postIds Array of post IDs
 * @param {string[]} blankUserIds Array of blank user IDs to use as likers
 * @returns {Promise<number>} Number of likes created
 */
async function createLikesForUserPosts(userId, postIds, blankUserIds) {
  if (postIds.length === 0) {
    console.log(`No posts found for user ${userId}. Skipping like creation.`);
    return 0;
  }
  
  console.log(`Creating likes for ${postIds.length} posts from user ${userId}...`);
  let totalLikesCreated = 0;
  
  try {
    for (const postId of postIds) {
      // Random number of likes for this post
      const likeCount = Math.floor(Math.random() * (MAX_LIKES - MIN_LIKES + 1)) + MIN_LIKES;
      
      // Random selection of blank users to be likers
      const shuffledUsers = [...blankUserIds].sort(() => 0.5 - Math.random());
      const selectedUsers = shuffledUsers.slice(0, likeCount);
      
      console.log(`Creating ${likeCount.toLocaleString()} likes for post ${postId}...`);
      
      // Split into smaller batches to avoid overwhelming the database
      const likeBatchSize = 5000;
      let createdLikes = 0;
      
      for (let i = 0; i < selectedUsers.length; i += likeBatchSize) {
        const currentBatch = selectedUsers.slice(i, i + likeBatchSize);
        
        // Prepare batch data
        const likeData = currentBatch.map(userId => ({
          userId,
          postId
        }));
        
        // Create likes in batch
        await prisma.like.createMany({
          data: likeData,
          skipDuplicates: true,
        });
        
        createdLikes += currentBatch.length;
        totalLikesCreated += currentBatch.length;
        
        // Add a small delay to avoid overwhelming the database
        if (i + likeBatchSize < selectedUsers.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log(`Created ${createdLikes.toLocaleString()} likes for post ${postId}`);
    }
    
    console.log(`Finished creating ${totalLikesCreated.toLocaleString()} likes for user ${userId}'s posts`);
    return totalLikesCreated;
  } catch (error) {
    console.error(`Error creating likes for user ${userId}'s posts:`, error);
    return totalLikesCreated;
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
  console.log('Starting blank user generation process...');
  console.log(`Target: ${NUM_USERS.toLocaleString()} blank users`);

  try {
    // Get all users first
    const allUsers = await getAllUsers();
    
    if (allUsers.length === 0) {
      console.error('No users found in the database. Cannot proceed with follower/like creation.');
      return;
    }
    
    console.log(`Found ${allUsers.length} total users who will receive followers and likes`);
    
    // Calculate the total number of batches
    const totalBatches = Math.ceil(NUM_USERS / BATCH_SIZE);
    console.log(`Will create users in ${totalBatches} batches of ${BATCH_SIZE} users each`);
    
    // Create users in batches and collect all user IDs
    let allBlankUserIds = [];
    for (let batchNumber = 1; batchNumber <= totalBatches; batchNumber++) {
      // For the last batch, may need fewer than BATCH_SIZE
      const currentBatchSize = batchNumber === totalBatches
        ? NUM_USERS - (batchNumber - 1) * BATCH_SIZE
        : BATCH_SIZE;
      
      console.log(`Creating batch ${batchNumber}/${totalBatches} (${currentBatchSize} users)...`);
      const batchUserIds = await createUserBatch(batchNumber, currentBatchSize);
      allBlankUserIds = [...allBlankUserIds, ...batchUserIds];
      
      console.log(`Progress: ${allBlankUserIds.length.toLocaleString()}/${NUM_USERS.toLocaleString()} users created (${(allBlankUserIds.length / NUM_USERS * 100).toFixed(2)}%)`);
      
      // Add delay between batches to avoid overwhelming the database
      if (batchNumber < totalBatches) {
        console.log('Waiting 3 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log(`Successfully created ${allBlankUserIds.length.toLocaleString()} blank users`);
    
    // Create follows and likes for each user
    for (const user of allUsers) {
      // Get a random follower count for this user
      const followerCount = Math.floor(Math.random() * (MAX_FOLLOWERS - MIN_FOLLOWERS + 1)) + MIN_FOLLOWERS;
      
      // Make sure we don't try to assign more followers than we have blank users
      const actualFollowerCount = Math.min(followerCount, allBlankUserIds.length);
      
      // Update follower count in metadata table
      await updateFollowerCountMetadata(user.id, actualFollowerCount);
      
      // Create follows
      await createFollowsForUser(user.id, actualFollowerCount, allBlankUserIds);
      
      // Get all posts for this user
      const postIds = await getUserPosts(user.id);
      
      // Create likes for each post
      if (postIds.length > 0) {
        await createLikesForUserPosts(user.id, postIds, allBlankUserIds);
      }
      
      // Small delay between processing users
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n----------------------------------------');
    console.log('Blank user generation and follow/like creation completed');
    console.log('----------------------------------------');
    console.log(`Total blank users created: ${allBlankUserIds.length.toLocaleString()}`);
    console.log(`Total users followed/liked: ${allUsers.length}`);
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