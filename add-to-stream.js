const { PrismaClient } = require('@prisma/client');
const { StreamChat } = require('stream-chat');
require('dotenv').config();

const prisma = new PrismaClient();

// Initialize Stream Chat client
const streamClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_KEY,
  process.env.STREAM_SECRET
);

async function addUserToStream() {
  try {
    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { id: 'bbx26z4rvpf7qmic' }
    });
    
    if (!user) {
      console.log('User not found in database');
      return;
    }
    
    console.log(`Found user: ${user.username} (${user.id})`);
    
    try {
      // Check if user already exists in Stream Chat
      await streamClient.queryUsers({ id: user.id }, {});
      console.log(`User ${user.username} (${user.id}) already exists in Stream Chat.`);
    } catch (error) {
      // If error code is 16, user doesn't exist in Stream Chat
      if (error.code === 16) {
        console.log(`User ${user.username} (${user.id}) doesn't exist in Stream Chat. Creating...`);
        
        // Add the user to Stream Chat
        await streamClient.upsertUser({
          id: user.id,
          username: user.username,
          name: user.displayName || user.username,
          image: user.avatarUrl,
        });
        
        console.log(`Successfully added user ${user.username} (${user.id}) to Stream Chat`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    await streamClient.disconnectUser();
  }
}

addUserToStream(); 