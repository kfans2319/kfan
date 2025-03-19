// Simple script to test URL variations for the video
const fetch = require('node-fetch');

async function testVideoUrl() {
  const baseUrl = 't8x8bguwl4.ufs.sh';
  const videoId = '5e7d80aa-602b-4dd3-9298-f9f173a8d4ac-p7ovvf.mp4';
  
  const variations = [
    `https://${baseUrl}/a/t8x8bguwl4/${videoId}`, // Original problematic URL
    `https://${baseUrl}/f/${videoId}`,            // /f/ path without t8x8bguwl4
    `https://${baseUrl}/a/${videoId}`,            // /a/ path without t8x8bguwl4
    `https://${baseUrl}/f/t8x8bguwl4/${videoId}`, // /f/ path with t8x8bguwl4
    `https://${baseUrl}/${videoId}`               // Direct path
  ];
  
  console.log('Testing URL variations for access:');
  
  for (const url of variations) {
    try {
      console.log(`Testing: ${url}`);
      const response = await fetch(url, { 
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      console.log(`  Status: ${response.status} ${response.statusText}`);
      console.log(`  Content-Type: ${response.headers.get('content-type')}`);
      console.log(`  Content-Length: ${response.headers.get('content-length')}`);
      console.log(`  ✅ Accessible: ${response.ok}`);
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    console.log('---');
  }
}

testVideoUrl().catch(console.error); 