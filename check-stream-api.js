const { StreamChat } = require('stream-chat');
require('dotenv').config();

// Initialize Stream Chat client
const streamClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_KEY,
  process.env.STREAM_SECRET
);

async function checkStreamApi() {
  try {
    console.log('Stream API Key:', process.env.NEXT_PUBLIC_STREAM_KEY);
    console.log('Stream Secret Length:', process.env.STREAM_SECRET ? process.env.STREAM_SECRET.length : 'not set');
    
    const userId = 'bbx26z4rvpf7qmic';
    
    try {
      // Try to get user directly - this should be more reliable
      const response = await streamClient.queryUsers({ id: userId });
      console.log('User lookup response:', response);
      
      if (response.users && response.users.length > 0) {
        console.log(`User found in Stream: ${response.users[0].name} (${response.users[0].id})`);
      } else {
        console.log('User not found in Stream');
      }
    } catch (error) {
      console.error('Error querying user:', error);
      
      // If we get here, try to create the user
      console.log('Attempting to create user...');
      try {
        await streamClient.upsertUser({
          id: userId,
          name: 'JoJoKinks',
          username: 'JoJoKinks',
        });
        console.log('User created successfully');
      } catch (createError) {
        console.error('Error creating user:', createError);
      }
    }
    
    // Log some debugging info
    console.log('\nServer-side Stream client info:');
    console.log('API Version:', streamClient.getAppSettings());
    
  } catch (error) {
    console.error('General error:', error);
  } finally {
    await streamClient.disconnectUser();
    console.log('Disconnected');
  }
}

checkStreamApi(); 