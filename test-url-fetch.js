// Simple script to test fetchability of a URL using built-in fetch
// Usage: node test-url-fetch.js

const PROBLEMATIC_URL = 'https://t8x8bguwl4.ufs.sh/a/t8x8bguwl4/5e7d80aa-602b-4dd3-9298-f9f173a8d4ac-p7ovvf.mp4';

// Define variations of the URL to test
const baseUrl = 't8x8bguwl4.ufs.sh';
const videoId = '5e7d80aa-602b-4dd3-9298-f9f173a8d4ac-p7ovvf.mp4';

const variations = [
  PROBLEMATIC_URL,  // Original problematic URL
  `https://${baseUrl}/f/${videoId}`,  // /f/ format (often more reliable)
  `https://${baseUrl}/a/${videoId}`,  // /a/ format without app ID
  `https://utfs.io/f/${videoId}`,      // Different domain
  `https://cdn.uploadthing.com/f/${videoId}` // CDN domain
];

async function testUrl(url) {
  console.log(`Testing URL: ${url}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Media URL Tester)'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log(`  Status: ${response.status} ${response.statusText}`);
    console.log(`  Content-Type: ${response.headers.get('content-type')}`);
    console.log(`  Content-Length: ${response.headers.get('content-length') || 'unknown'}`);
    console.log(`  Success: ${response.ok ? 'YES ✅' : 'NO ❌'}`);
    
    return {
      url,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    };
  } catch (error) {
    console.log(`  Error: ${error.message} ❌`);
    
    return {
      url,
      status: 'error',
      ok: false,
      error: error.message
    };
  }
}

async function testAllUrls() {
  console.log('🔍 Testing URL variations for accessibility...\n');
  
  const results = [];
  
  for (const url of variations) {
    console.log('-'.repeat(80));
    const result = await testUrl(url);
    results.push(result);
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('\n📊 Summary of results:');
  
  const workingUrls = results.filter(r => r.ok);
  console.log(`\n${workingUrls.length} of ${variations.length} URLs are accessible.`);
  
  if (workingUrls.length > 0) {
    console.log('\n✅ Working URLs:');
    workingUrls.forEach(r => console.log(`  - ${r.url}`));
  } else {
    console.log('\n❌ No working URLs found.');
  }
  
  console.log('\n🔧 Recommendation:');
  if (workingUrls.length > 0) {
    console.log(`  Use this URL format: ${workingUrls[0].url}`);
    console.log(`  Or use media proxy: /api/media-proxy?url=${encodeURIComponent(workingUrls[0].url)}`);
  } else {
    console.log('  Use the media proxy with various URL formats and ensure your proxy has proper error handling.');
  }
}

testAllUrls().catch(console.error); 