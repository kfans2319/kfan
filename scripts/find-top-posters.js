/**
 * This script finds users with the most posts in the database
 * and displays information about them to help identify the most
 * valuable content creators.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configuration
const TOP_USERS_COUNT = 50; // Number of top users to display
const INCLUDE_FOLLOWERS = true; // Whether to include follower counts (can be slow for large datasets)
const INCLUDE_LIKES = true; // Whether to include like counts (can be slow for large datasets)

/**
 * Main function to find users with the most posts
 */
async function findTopPosters() {
  console.log('Finding users with the most posts...');
  
  try {
    // Get users with the most posts
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: INCLUDE_FOLLOWERS,
            following: INCLUDE_FOLLOWERS,
          }
        }
      },
      orderBy: {
        posts: {
          _count: 'desc'
        }
      },
      take: TOP_USERS_COUNT
    });
    
    console.log(`\nTop ${users.length} users with most posts:\n`);
    
    // Table header
    let header = 'Rank | Username | DisplayName | Posts';
    if (INCLUDE_FOLLOWERS) header += ' | Followers | Following';
    if (INCLUDE_LIKES) header += ' | Total Likes';
    console.log(header);
    console.log('-'.repeat(header.length));
    
    // Process each user
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      // Get total likes for the user's posts if requested
      let totalLikes = 0;
      if (INCLUDE_LIKES) {
        const likesResult = await prisma.like.count({
          where: {
            post: {
              userId: user.id
            }
          }
        });
        totalLikes = likesResult;
      }
      
      // Format the user data
      let userInfo = `${i+1}`.padStart(4) + ' | ';
      userInfo += `${user.username}`.padEnd(20) + ' | ';
      userInfo += `${user.displayName || '[No Name]'}`.padEnd(20) + ' | ';
      userInfo += `${user._count.posts}`.padStart(5);
      
      if (INCLUDE_FOLLOWERS) {
        userInfo += ' | ' + `${user._count.followers}`.padStart(9);
        userInfo += ' | ' + `${user._count.following}`.padStart(9);
      }
      
      if (INCLUDE_LIKES) {
        userInfo += ' | ' + `${totalLikes}`.padStart(11);
      }
      
      console.log(userInfo);
    }
    
    // Summary
    console.log('\nSummary:');
    const totalPostsFromTopUsers = users.reduce((sum, user) => sum + user._count.posts, 0);
    console.log(`These ${users.length} users have created ${totalPostsFromTopUsers} posts.`);
    
    // Get total posts in the system for comparison
    const totalPosts = await prisma.post.count();
    const percentage = (totalPostsFromTopUsers / totalPosts * 100).toFixed(2);
    console.log(`Total posts in the system: ${totalPosts}`);
    console.log(`The top ${users.length} users account for ${percentage}% of all posts.`);
    
    // Add info about these users to help make preservation decisions
    console.log('\nTo preserve these valuable users when reducing database size:');
    console.log('1. You could export just these users and their content');
    console.log('2. Or ensure these users are not deleted in cleanup operations');
    console.log(`3. User IDs for reference: ${users.map(u => u.id).join(', ')}`);
    
  } catch (error) {
    console.error('An error occurred while finding top posters:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the main function
findTopPosters()
  .then(() => {
    console.log('\nScript execution completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 