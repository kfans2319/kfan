const { PrismaClient } = require('@prisma/client');
const { StreamChat } = require('stream-chat');
require('dotenv').config();

const prisma = new PrismaClient();

// Initialize Stream Chat client
const streamClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_KEY,
  process.env.STREAM_SECRET
);

async function createStreamUser() {
  try {
    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { id: 'bbx26z4rvpf7qmic' }
    });
    
    if (!user) {
      console.log('User not found in database');
      return;
    }
    
    console.log(`Found user in database: ${user.username} (${user.id})`);
    console.log('User details:', {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl
    });
    
    // Now create the user in Stream Chat
    try {
      const result = await streamClient.upsertUser({
        id: user.id,
        username: user.username,
        name: user.displayName || user.username,
        image: user.avatarUrl,
      });
      
      console.log('User creation result:', result);
      console.log(`Successfully created user ${user.username} in Stream Chat`);
    } catch (error) {
      console.error('Error creating user in Stream Chat:', error);
    }
    
    // Verify user creation
    try {
      const response = await streamClient.queryUsers({ id: user.id });
      
      if (response.users && response.users.length > 0) {
        console.log(`Verification: User found in Stream: ${response.users[0].name} (${response.users[0].id})`);
      } else {
        console.log('Verification: User still not found in Stream after creation attempt');
      }
    } catch (verifyError) {
      console.error('Error verifying user:', verifyError);
    }
    
  } catch (error) {
    console.error('General error:', error);
  } finally {
    await prisma.$disconnect();
    await streamClient.disconnectUser();
    console.log('Disconnected from Stream');
  }
}

createStreamUser(); 