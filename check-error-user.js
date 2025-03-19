const { StreamChat } = require('stream-chat');
require('dotenv').config();

// Initialize Stream Chat client
const streamClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_KEY,
  process.env.STREAM_SECRET
);

// The user ID from the error message
const userId = 'bbx26z4rvpf7qmic';

async function verifyUser() {
  try {
    console.log(`Verifying user ID: ${userId}`);
    
    // Test 1: Direct API query
    try {
      const response = await streamClient.queryUsers({ id: userId });
      
      if (response.users && response.users.length > 0) {
        console.log(`✅ User found in Stream API query: ${response.users[0].name} (${response.users[0].id})`);
      } else {
        console.log('❌ User not found in Stream API query');
      }
    } catch (error) {
      console.error('❌ Error querying user:', error);
    }
    
    // Test 2: Create user token
    try {
      const token = streamClient.createToken(userId);
      console.log(`✅ Successfully created token for user: ${token.substring(0, 20)}...`);
    } catch (error) {
      console.error('❌ Error creating token:', error);
    }
    
    // Test 3: Check unread counts directly (this is what triggered the error)
    try {
      // This mimics what the client-side code is doing
      const unreadCounts = await streamClient.queryChannels(
        { type: 'messaging', members: { $in: [userId] } },
        { last_message_at: -1 },
        { limit: 30, state: true, watch: false },
      );
      
      console.log(`✅ Successfully retrieved channels for user: Found ${unreadCounts.length} channels`);
    } catch (error) {
      console.error('❌ Error getting unread counts:', error);
    }
    
  } catch (error) {
    console.error('General error:', error);
  } finally {
    await streamClient.disconnectUser();
    console.log('Disconnected from Stream');
  }
}

verifyUser(); 