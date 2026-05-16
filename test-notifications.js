// Test script to verify in-app + push notifications
// Run this in browser console after logging in

async function testConnectionRequest() {
    console.log('🧪 Testing connection request notification...');
    
    // Import the connection service
    const { sendConnectionRequest } = await import('./src/services/connectionService.ts');
    
    // Test with your user ID and another test user ID
    const senderUid = '2l81qAJ0GrP8yLZGbLF2pU5SPdj2'; // Your user ID
    const targetUid = 'test-user-id'; // Replace with another test user ID
    
    try {
        await sendConnectionRequest(senderUid, targetUid);
        console.log('✅ Connection request sent! Check for:');
        console.log('  1. In-app notification in target user\'s notifications');
        console.log('  2. Browser push notification if target user is online');
        console.log('  3. FCM queue document created and processed');
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Instructions:
// 1. Open browser console on your ProCollab app
// 2. Make sure you're logged in
// 3. Replace 'test-user-id' with a real user ID from your system
// 4. Run: testConnectionRequest()