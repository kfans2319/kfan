/**
 * This script updates all posts in the database with random dates
 * between January 2024 and the current date to create a more natural
 * timeline distribution for the "For You" page.
 * 
 * Modified to only update posts from a specific user.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configuration
const BATCH_SIZE = 100; // Process posts in batches to avoid memory issues
const START_DATE = new Date('2024-01-01'); // January 1, 2024
const END_DATE = new Date(); // Current date
const TARGET_USERNAME = 'JoJoKinks'; // Only randomize posts for this user

/**
 * Generate a random date between start and end dates
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Date} Random date between start and end
 */
function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Updates a batch of posts with random dates
 * @param {Array} posts - Array of post objects
 * @returns {Promise<number>} Number of successfully updated posts
 */
async function updatePostBatch(posts) {
  let successCount = 0;
  
  for (const post of posts) {
    try {
      const randomDate = getRandomDate(START_DATE, END_DATE);
      
      await prisma.post.update({
        where: { 
          id: post.id 
        },
        data: { 
          createdAt: randomDate
        }
      });
      
      successCount++;
      
      // Log every 10 posts for progress tracking without overwhelming the console
      if (successCount % 10 === 0) {
        console.log(`Updated ${successCount} posts in current batch`);
      }
    } catch (error) {
      console.error(`Error updating post ${post.id}:`, error.message);
    }
  }
  
  return successCount;
}

/**
 * Main function to update post dates for a specific user
 */
async function randomizePostDates() {
  console.log(`Starting post date randomization for user: ${TARGET_USERNAME}...`);
  console.log(`Date range: ${START_DATE.toISOString()} to ${END_DATE.toISOString()}`);
  
  let skip = 0;
  let totalUpdated = 0;
  let batchCount = 0;
  
  try {
    // First get the user ID for the specified username
    const user = await prisma.user.findUnique({
      where: {
        username: TARGET_USERNAME
      },
      select: {
        id: true
      }
    });
    
    if (!user) {
      console.error(`User with username "${TARGET_USERNAME}" not found!`);
      return;
    }
    
    console.log(`Found user with ID: ${user.id}`);
    
    // Count total posts to provide progress updates
    const totalPosts = await prisma.post.count({
      where: {
        userId: user.id
      }
    });
    
    console.log(`Found ${totalPosts} posts by ${TARGET_USERNAME} to process`);
    
    if (totalPosts === 0) {
      console.log('No posts to update. Exiting.');
      return;
    }
    
    while (true) {
      // Fetch a batch of posts for the specific user
      const posts = await prisma.post.findMany({
        where: {
          userId: user.id
        },
        skip,
        take: BATCH_SIZE,
        select: {
          id: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      
      // Break if no more posts to process
      if (posts.length === 0) {
        break;
      }
      
      batchCount++;
      console.log(`\nProcessing batch ${batchCount} (${posts.length} posts)...`);
      
      // Update the batch
      const updatedCount = await updatePostBatch(posts);
      totalUpdated += updatedCount;
      
      console.log(`Batch ${batchCount} complete. Updated ${updatedCount}/${posts.length} posts.`);
      console.log(`Progress: ${totalUpdated}/${totalPosts} posts (${Math.round(totalUpdated/totalPosts*100)}%)`);
      
      // Move to next batch
      skip += BATCH_SIZE;
    }
    
    console.log(`\nPost date randomization for ${TARGET_USERNAME} complete!`);
    console.log(`Successfully updated ${totalUpdated} posts with random dates.`);
    
  } catch (error) {
    console.error('An error occurred during post date randomization:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the main function
randomizePostDates()
  .then(() => {
    console.log('Script execution completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 