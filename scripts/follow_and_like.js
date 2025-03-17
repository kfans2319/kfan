// Configuration
const MIN_FOLLOWERS = 40;
const MAX_FOLLOWERS = 500;
const MIN_LIKES = 20;
const MAX_LIKES = 100;

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
 * Main function to run the script
 */
async function main() {
  console.log('Starting follow and like creation process...');

  try {
    // Get all users first
    const allUsers = await getAllUsers();
    
    if (allUsers.length === 0) {
      console.error('No users found in the database. Cannot proceed with follower/like creation.');
      return;
    }
    
    console.log(`Found ${allUsers.length} total users who will receive followers and likes`);
    
    // Get all blank user IDs
    const allBlankUserIds = await getBlankUserIds();
    
    if (allBlankUserIds.length === 0) {
      console.error('No blank users found in the database. Cannot proceed with follower/like creation.');
      return;
    }
    
    console.log(`Found ${allBlankUserIds.length} blank users to use for follows and likes`);
    
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
    console.log('Follow and like creation completed');
    console.log('----------------------------------------');
    console.log(`Total users followed/liked: ${allUsers.length}`);
    console.log(`Total blank users used: ${allBlankUserIds.length}`);
  } catch (error) {
    console.error('Error in main process:', error);
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
} 