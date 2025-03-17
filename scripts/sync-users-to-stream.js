/**
 * Stream Chat User Synchronization Script
 * 
 * This script synchronizes all existing users in the database with Stream Chat.
 * It finds all users that exist in the database but not in Stream Chat, and registers them.
 */

const { PrismaClient } = require('@prisma/client');
const { StreamChat } = require('stream-chat');

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Stream Chat client
const streamClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_KEY,
  process.env.STREAM_SECRET
);

async function syncUsersToStream() {
  console.log('Starting Stream Chat user synchronization...');
  
  try {
    // Fetch all users from the database
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
      take: 1000 // Process up to 1000 users at a time
    });
    
    console.log(`Found ${users.length} users in the database`);
    
    // Process users in batches to avoid rate limits
    const BATCH_SIZE = 25;
    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(users.length / BATCH_SIZE)}`);
      
      for (const user of batch) {
        try {
          // Try to get the user from Stream Chat
          try {
            await streamClient.queryUsers({ id: user.id }, {});
            console.log(`User ${user.username} (${user.id}) already exists in Stream Chat. Skipping...`);
            skippedCount++;
            continue;
          } catch (error) {
            // User doesn't exist in Stream Chat, create them
            if (error.code === 16) {
              console.log(`User ${user.username} (${user.id}) doesn't exist in Stream Chat. Creating...`);
              
              await streamClient.upsertUser({
                id: user.id,
                username: user.username,
                name: user.displayName || user.username,
                image: user.avatarUrl,
              });
              
              console.log(`Created user ${user.username} (${user.id}) in Stream Chat`);
              syncedCount++;
            } else {
              throw error;
            }
          }
        } catch (error) {
          console.error(`Error processing user ${user.username} (${user.id}):`, error);
          errorCount++;
        }
      }
      
      // Add a short delay between batches to avoid rate limits
      if (i + BATCH_SIZE < users.length) {
        console.log(`Waiting 2 seconds before the next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Print summary
    console.log('\n----------------------------------------');
    console.log('Stream Chat user synchronization complete');
    console.log('----------------------------------------');
    console.log(`Total users: ${users.length}`);
    console.log(`Users synchronized: ${syncedCount}`);
    console.log(`Users already in Stream Chat: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Synchronization error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
syncUsersToStream().then(() => {
  console.log('Script execution completed');
  process.exit(0);
}).catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 