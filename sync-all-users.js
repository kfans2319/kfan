const { PrismaClient } = require('@prisma/client');
const { StreamChat } = require('stream-chat');
require('dotenv').config();

const prisma = new PrismaClient();

// Initialize Stream Chat client
const streamClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_KEY,
  process.env.STREAM_SECRET
);

async function syncAllUsersToStream() {
  console.log('Starting user synchronization with Stream Chat...');
  
  try {
    // Fetch all users from the database
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    });
    
    console.log(`Found ${users.length} users in the database`);
    
    // Process users in batches to avoid rate limits
    const BATCH_SIZE = 10;
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(users.length / BATCH_SIZE)}`);
      
      // Process each user in the batch
      for (const user of batch) {
        try {
          console.log(`Processing user ${user.username} (${user.id})`);
          
          // Try to create the user in Stream Chat
          await streamClient.upsertUser({
            id: user.id,
            username: user.username,
            name: user.displayName || user.username,
            image: user.avatarUrl,
          });
          
          console.log(`Created/updated user ${user.username} in Stream Chat`);
          createdCount++;
        } catch (error) {
          console.error(`Error processing user ${user.username} (${user.id}):`, error);
          errorCount++;
        }
      }
      
      // Add a small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < users.length) {
        console.log('Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Print summary
    console.log('\n-----------------------------------');
    console.log('Stream Chat Synchronization Complete');
    console.log('-----------------------------------');
    console.log(`Total users: ${users.length}`);
    console.log(`Users created/updated: ${createdCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('General error:', error);
  } finally {
    await prisma.$disconnect();
    await streamClient.disconnectUser();
    console.log('Disconnected from Stream');
  }
}

// Run the script
syncAllUsersToStream().then(() => {
  console.log('Script completed successfully');
}).catch(err => {
  console.error('Script failed:', err);
}); 