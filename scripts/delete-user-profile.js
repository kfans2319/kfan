/**
 * This script completely deletes a user profile and all associated data.
 * 
 * IMPORTANT: This is a destructive operation and cannot be undone.
 * All related data including posts, media, likes, comments, follows, etc.
 * will be permanently deleted.
 * 
 * Target user: JoJoKinks
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

// Initialize Prisma client with logging
const prisma = new PrismaClient({
  log: ['warn', 'error']
});

// Configuration
const TARGET_USERNAME = 'JoJoKinks';
const SLEEP_BETWEEN_OPERATIONS = 100; // Milliseconds to sleep between operations
const DRY_RUN = false; // Set to true to simulate without actually deleting

/**
 * Sleep function to add delay between operations
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create readline interface for user input
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompt user for confirmation
 * @param {string} question - Question to ask
 * @returns {Promise<boolean>} - True if confirmed, false otherwise
 */
function confirm(question) {
  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Get user information
 * @param {string} username - Username to find
 * @returns {Promise<Object>} - User data
 */
async function getUserInfo(username) {
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bannerImageUrl: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
            likes: true,
            comments: true,
          }
        }
      }
    });

    if (!user) {
      throw new Error(`User ${username} not found`);
    }

    return user;
  } catch (error) {
    console.error('Error getting user info:', error);
    throw error;
  }
}

/**
 * Delete follows where user is either follower or following
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of follows deleted
 */
async function deleteFollows(userId) {
  console.log('Deleting follows...');
  let count = 0;

  try {
    // Delete where user is following others
    const followingResult = await prisma.follow.deleteMany({
      where: {
        followerId: userId
      }
    });
    count += followingResult.count;
    console.log(`Deleted ${followingResult.count} follows (user following others)`);
    await sleep(SLEEP_BETWEEN_OPERATIONS);

    // Delete where user is followed by others
    const followerResult = await prisma.follow.deleteMany({
      where: {
        followingId: userId
      }
    });
    count += followerResult.count;
    console.log(`Deleted ${followerResult.count} follows (others following user)`);
    await sleep(SLEEP_BETWEEN_OPERATIONS);

    // Delete any metadata records for follower counts if they exist
    try {
      await prisma.$executeRaw`DELETE FROM "_followmeta" WHERE userid = ${userId}`;
      console.log('Deleted follow metadata');
    } catch (error) {
      // Ignore if table doesn't exist
      if (!error.message.includes('relation "_followmeta" does not exist')) {
        console.warn(`Warning: Could not delete follow metadata: ${error.message}`);
      }
    }

    return count;
  } catch (error) {
    console.error('Error deleting follows:', error);
    return count;
  }
}

/**
 * Delete likes by and for the user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of likes deleted
 */
async function deleteLikes(userId) {
  console.log('Deleting likes...');
  let count = 0;

  try {
    // Delete likes by this user on others' posts
    const userLikesResult = await prisma.like.deleteMany({
      where: {
        userId
      }
    });
    count += userLikesResult.count;
    console.log(`Deleted ${userLikesResult.count} likes created by user`);
    await sleep(SLEEP_BETWEEN_OPERATIONS);

    // Delete likes on this user's posts
    const postLikesResult = await prisma.like.deleteMany({
      where: {
        post: {
          userId
        }
      }
    });
    count += postLikesResult.count;
    console.log(`Deleted ${postLikesResult.count} likes on user's posts`);
    await sleep(SLEEP_BETWEEN_OPERATIONS);

    return count;
  } catch (error) {
    console.error('Error deleting likes:', error);
    return count;
  }
}

/**
 * Delete comments by and for the user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of comments deleted
 */
async function deleteComments(userId) {
  console.log('Deleting comments...');
  let count = 0;

  try {
    // Delete comments by this user on others' posts
    const userCommentsResult = await prisma.comment.deleteMany({
      where: {
        userId
      }
    });
    count += userCommentsResult.count;
    console.log(`Deleted ${userCommentsResult.count} comments created by user`);
    await sleep(SLEEP_BETWEEN_OPERATIONS);

    // Delete comments on this user's posts
    const postCommentsResult = await prisma.comment.deleteMany({
      where: {
        post: {
          userId
        }
      }
    });
    count += postCommentsResult.count;
    console.log(`Deleted ${postCommentsResult.count} comments on user's posts`);
    await sleep(SLEEP_BETWEEN_OPERATIONS);

    return count;
  } catch (error) {
    console.error('Error deleting comments:', error);
    return count;
  }
}

/**
 * Delete bookmarks by and for the user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of bookmarks deleted
 */
async function deleteBookmarks(userId) {
  console.log('Deleting bookmarks...');
  let count = 0;

  try {
    // Delete bookmarks by this user
    const userBookmarksResult = await prisma.bookmark.deleteMany({
      where: {
        userId
      }
    });
    count += userBookmarksResult.count;
    console.log(`Deleted ${userBookmarksResult.count} bookmarks created by user`);
    await sleep(SLEEP_BETWEEN_OPERATIONS);

    // Delete bookmarks of this user's posts
    const postBookmarksResult = await prisma.bookmark.deleteMany({
      where: {
        post: {
          userId
        }
      }
    });
    count += postBookmarksResult.count;
    console.log(`Deleted ${postBookmarksResult.count} bookmarks of user's posts`);
    await sleep(SLEEP_BETWEEN_OPERATIONS);

    return count;
  } catch (error) {
    console.error('Error deleting bookmarks:', error);
    return count;
  }
}

/**
 * Delete subscriptions by and for the user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of subscriptions deleted
 */
async function deleteSubscriptions(userId) {
  console.log('Deleting subscriptions and subscription tiers...');
  let count = 0;

  try {
    // Find subscription tiers created by this user
    const tiers = await prisma.subscriptionTier.findMany({
      where: {
        creatorId: userId
      },
      select: {
        id: true
      }
    });
    
    if (tiers.length > 0) {
      const tierIds = tiers.map(tier => tier.id);
      
      // Delete subscriptions to these tiers
      const subscriptionsResult = await prisma.subscription.deleteMany({
        where: {
          tierId: {
            in: tierIds
          }
        }
      });
      count += subscriptionsResult.count;
      console.log(`Deleted ${subscriptionsResult.count} subscriptions to user's tiers`);
      await sleep(SLEEP_BETWEEN_OPERATIONS);
      
      // Delete the tiers
      const tiersResult = await prisma.subscriptionTier.deleteMany({
        where: {
          creatorId: userId
        }
      });
      count += tiersResult.count;
      console.log(`Deleted ${tiersResult.count} subscription tiers`);
      await sleep(SLEEP_BETWEEN_OPERATIONS);
    } else {
      console.log('No subscription tiers found for this user');
    }
    
    // Delete subscriptions made by this user to others
    const userSubscriptionsResult = await prisma.subscription.deleteMany({
      where: {
        subscriberId: userId
      }
    });
    count += userSubscriptionsResult.count;
    console.log(`Deleted ${userSubscriptionsResult.count} subscriptions by user to others`);
    await sleep(SLEEP_BETWEEN_OPERATIONS);
    
    return count;
  } catch (error) {
    console.error('Error deleting subscriptions:', error);
    return count;
  }
}

/**
 * Delete media files associated with a user
 * @param {string} userId - User ID
 * @param {Object} user - User data with avatar and banner URLs
 * @returns {Promise<number>} - Number of files deleted
 */
async function deleteMediaFiles(userId, user) {
  console.log('Checking for media files to delete...');
  let count = 0;
  
  if (DRY_RUN) {
    console.log('DRY RUN: Would delete media files');
    return 0;
  }
  
  try {
    // Get posts with attachments
    const postsWithAttachments = await prisma.post.findMany({
      where: {
        userId,
        attachments: {
          some: {}
        }
      },
      include: {
        attachments: true
      }
    });
    
    // Extract URLs
    const urls = [];
    
    // Add avatar and banner if they exist
    if (user.avatarUrl) urls.push(user.avatarUrl);
    if (user.bannerImageUrl) urls.push(user.bannerImageUrl);
    
    // Add attachment URLs
    for (const post of postsWithAttachments) {
      for (const attachment of post.attachments) {
        urls.push(attachment.url);
      }
    }
    
    // Try to delete files from public directory
    const publicDir = path.join(process.cwd(), 'public');
    let filesDeleted = 0;
    
    for (const url of urls) {
      // Extract the file path from the URL
      // URLs might be in formats like:
      // - /images/avatar_123.jpg
      // - https://example.com/images/avatar_123.jpg
      // - /api/uploadthing/files/avatar_123.jpg
      
      try {
        // Try to extract the filename
        let filePath = '';
        
        if (url.startsWith('/')) {
          // Relative URL
          filePath = url.substring(1); // Remove leading slash
        } else if (url.includes('/')) {
          // Extract path after domain
          const parsedUrl = new URL(url);
          filePath = parsedUrl.pathname.substring(1); // Remove leading slash
        }
        
        if (filePath) {
          // Check if file exists in public directory
          const fullPath = path.join(publicDir, filePath);
          try {
            await fs.access(fullPath);
            // File exists, delete it
            await fs.unlink(fullPath);
            filesDeleted++;
            console.log(`Deleted media file: ${filePath}`);
          } catch (err) {
            // File doesn't exist or can't be accessed
            console.log(`Media file not found or can't be accessed: ${filePath}`);
          }
        }
      } catch (err) {
        console.warn(`Error processing URL ${url}: ${err.message}`);
      }
    }
    
    console.log(`Deleted ${filesDeleted} media files`);
    count += filesDeleted;
    
    return count;
  } catch (error) {
    console.error('Error deleting media files:', error);
    return count;
  }
}

/**
 * Delete attachments associated with a user's posts
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of attachments deleted
 */
async function deleteAttachments(userId) {
  console.log('Deleting post attachments...');
  let count = 0;
  
  try {
    const userPosts = await prisma.post.findMany({
      where: { userId },
      select: { id: true }
    });
    
    if (userPosts.length > 0) {
      const postIds = userPosts.map(post => post.id);
      
      const attachmentsResult = await prisma.attachment.deleteMany({
        where: {
          postId: {
            in: postIds
          }
        }
      });
      
      count += attachmentsResult.count;
      console.log(`Deleted ${attachmentsResult.count} post attachments`);
      await sleep(SLEEP_BETWEEN_OPERATIONS);
    } else {
      console.log('No posts found for this user');
    }
    
    return count;
  } catch (error) {
    console.error('Error deleting attachments:', error);
    return count;
  }
}

/**
 * Delete all posts by a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of posts deleted
 */
async function deletePosts(userId) {
  console.log('Deleting posts...');
  
  try {
    // Delete all posts by this user
    const postsResult = await prisma.post.deleteMany({
      where: {
        userId
      }
    });
    
    console.log(`Deleted ${postsResult.count} posts`);
    await sleep(SLEEP_BETWEEN_OPERATIONS);
    
    return postsResult.count;
  } catch (error) {
    console.error('Error deleting posts:', error);
    return 0;
  }
}

/**
 * Delete the user profile completely
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - True if successful
 */
async function deleteUserProfile(userId) {
  try {
    await prisma.user.delete({
      where: {
        id: userId
      }
    });
    
    console.log('Deleted user profile');
    return true;
  } catch (error) {
    console.error('Error deleting user profile:', error);
    return false;
  }
}

/**
 * Main function to delete a user and all associated data
 */
async function deleteUser() {
  console.log(`Starting deletion process for user ${TARGET_USERNAME}...`);
  
  if (DRY_RUN) {
    console.log('DRY RUN MODE: No data will actually be deleted');
  }
  
  try {
    // Get user info
    const user = await getUserInfo(TARGET_USERNAME);
    console.log('\nUser information:');
    console.log(`- Username: ${user.username}`);
    console.log(`- Display Name: ${user.displayName || '[None]'}`);
    console.log(`- ID: ${user.id}`);
    console.log(`- Created At: ${user.createdAt}`);
    console.log(`- Posts: ${user._count.posts}`);
    console.log(`- Followers: ${user._count.followers}`);
    console.log(`- Following: ${user._count.following}`);
    console.log(`- Likes: ${user._count.likes}`);
    console.log(`- Comments: ${user._count.comments}`);
    
    // Confirm deletion
    if (!DRY_RUN) {
      const confirmed = await confirm(`\nWARNING: You are about to delete user ${TARGET_USERNAME} and ALL their data. This action CANNOT be undone. Are you sure?`);
      
      if (!confirmed) {
        console.log('Deletion cancelled by user.');
        rl.close();
        await prisma.$disconnect();
        return;
      }
      
      const doubleConfirmed = await confirm(`\nAre you ABSOLUTELY SURE? Type 'yes' to confirm.`);
      
      if (!doubleConfirmed) {
        console.log('Deletion cancelled by user.');
        rl.close();
        await prisma.$disconnect();
        return;
      }
    }
    
    console.log('\nBeginning deletion process...');
    
    // Delete in order to maintain referential integrity
    
    // 1. Delete social connections
    const followsDeleted = await deleteFollows(user.id);
    
    // 2. Delete interactions
    const likesDeleted = await deleteLikes(user.id);
    const commentsDeleted = await deleteComments(user.id);
    const bookmarksDeleted = await deleteBookmarks(user.id);
    
    // 3. Delete subscriptions
    const subscriptionsDeleted = await deleteSubscriptions(user.id);
    
    // 4. Delete media files (won't actually delete in dry run)
    const filesDeleted = await deleteMediaFiles(user.id, user);
    
    // 5. Delete post attachments
    const attachmentsDeleted = await deleteAttachments(user.id);
    
    // 6. Delete posts
    const postsDeleted = await deletePosts(user.id);
    
    // 7. Finally, delete the user
    let userDeleted = false;
    if (!DRY_RUN) {
      userDeleted = await deleteUserProfile(user.id);
    } else {
      console.log('DRY RUN: Would delete user profile');
      userDeleted = true;
    }
    
    // Summarize
    console.log('\n===============================================');
    console.log(`           DELETION ${DRY_RUN ? 'SIMULATION' : 'COMPLETE'}            `);
    console.log('===============================================');
    console.log(`User: ${user.username} (${user.displayName || 'No display name'})`);
    console.log(`- Follows deleted: ${followsDeleted}`);
    console.log(`- Likes deleted: ${likesDeleted}`);
    console.log(`- Comments deleted: ${commentsDeleted}`);
    console.log(`- Bookmarks deleted: ${bookmarksDeleted}`);
    console.log(`- Subscriptions deleted: ${subscriptionsDeleted}`);
    console.log(`- Media files deleted: ${filesDeleted}`);
    console.log(`- Attachments deleted: ${attachmentsDeleted}`);
    console.log(`- Posts deleted: ${postsDeleted}`);
    console.log(`- User profile deleted: ${userDeleted ? 'Yes' : 'No'}`);
    
    if (DRY_RUN) {
      console.log('\nThis was a dry run. No actual data was deleted.');
      console.log('To perform the actual deletion, edit the script and set DRY_RUN to false.');
    }
    
  } catch (error) {
    console.error('Error during user deletion process:', error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Execute the main function
deleteUser()
  .then(() => {
    console.log('\nScript execution completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 