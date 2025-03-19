'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MediaDebugPage() {
  const [url, setUrl] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('checker');
  
  const [videoUrl, setVideoUrl] = useState('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  const [alternativeUrls, setAlternativeUrls] = useState<string[]>([]);
  const [workingUrls, setWorkingUrls] = useState<string[]>([]);
  
  // Add the problematic URL as default state
  useEffect(() => {
    if (!url) {
      setUrl('https://t8x8bguwl4.ufs.sh/a/t8x8bguwl4/5e7d80aa-602b-4dd3-9298-f9f173a8d4ac-p7ovvf.mp4');
      
      // Set up alternative URLs to try for our known problematic video
      setAlternativeUrls([
        'https://t8x8bguwl4.ufs.sh/f/5e7d80aa-602b-4dd3-9298-f9f173a8d4ac-p7ovvf.mp4',
        'https://t8x8bguwl4.ufs.sh/file/5e7d80aa-602b-4dd3-9298-f9f173a8d4ac-p7ovvf.mp4',
        'https://t8x8bguwl4.ufs.sh/v/5e7d80aa-602b-4dd3-9298-f9f173a8d4ac-p7ovvf.mp4',
        'https://utfs.io/f/5e7d80aa-602b-4dd3-9298-f9f173a8d4ac-p7ovvf.mp4',
        'https://cdn.uploadthing.com/f/5e7d80aa-602b-4dd3-9298-f9f173a8d4ac-p7ovvf.mp4'
      ]);
    }
  }, []);

  const checkUrl = async () => {
    if (!url) return;
    
    setLoading(true);
    setResults(null);
    
    try {
      const response = await fetch(`/api/check-media?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      setResults({ error: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const checkVideoPlayback = () => {
    if (!videoUrl) return;
    
    setVideoError(null);
    setVideoLoaded(false);
  };
  
  const testProxyUrl = () => {
    if (!url) return;
    setVideoUrl(`/api/media-proxy?url=${encodeURIComponent(url)}`);
    setActiveTab('player');
  };
  
  const testAllUrls = async () => {
    // Get URLs from textarea, splitting by line
    let urls = alternativeUrls;
    
    // Reset results
    setWorkingUrls([]);
    
    // Test each URL
    for (const testUrl of urls) {
      // Create a video element to test the URL
      const video = document.createElement('video');
      
      // Create a promise to check if the video loads
      const checkPromise = new Promise<boolean>((resolve) => {
        // Set timeout for 5 seconds
        const timeout = setTimeout(() => {
          video.removeEventListener('loadeddata', handleSuccess);
          video.removeEventListener('error', handleError);
          resolve(false);
        }, 5000);
        
        // Success handler
        const handleSuccess = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadeddata', handleSuccess);
          video.removeEventListener('error', handleError);
          resolve(true);
        };
        
        // Error handler
        const handleError = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadeddata', handleSuccess);
          video.removeEventListener('error', handleError);
          resolve(false);
        };
        
        // Add event listeners
        video.addEventListener('loadeddata', handleSuccess);
        video.addEventListener('error', handleError);
      });
      
      // Test the URL directly
      video.src = testUrl;
      video.load();
      const directResult = await checkPromise;
      
      // Test the URL through proxy
      video.src = `/api/media-proxy?url=${encodeURIComponent(testUrl)}`;
      video.load();
      const proxyResult = await checkPromise;
      
      // If either worked, add to working URLs
      if (directResult || proxyResult) {
        setWorkingUrls(prev => [...prev, testUrl]);
      }
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Media Debug Tools</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="checker">URL Checker</TabsTrigger>
          <TabsTrigger value="player">Video Player</TabsTrigger>
          <TabsTrigger value="multi">Multi Tester</TabsTrigger>
        </TabsList>
        
        <TabsContent value="checker">
          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Media URL</label>
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="flex-1"
                />
                <Button onClick={checkUrl} disabled={loading}>
                  {loading ? 'Checking...' : 'Check URL'}
                </Button>
                <Button onClick={testProxyUrl} disabled={!url || loading} variant="outline">
                  Test in Proxy
                </Button>
              </div>
            </div>
            
            {results && (
              <div className="mt-4">
                <h2 className="text-lg font-semibold mb-2">Results</h2>
                <pre className="bg-muted p-4 rounded overflow-auto max-h-96">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="player">
          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Video URL</label>
              <div className="flex gap-2">
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="flex-1"
                />
                <Button onClick={checkVideoPlayback} disabled={!videoUrl}>
                  Test
                </Button>
              </div>
              
              <div className="mt-4">
                {videoUrl && (
                  <div className="border rounded overflow-hidden">
                    <video
                      key={videoUrl}
                      src={videoUrl}
                      controls
                      className="w-full"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        console.error("Video error:", e);
                        setVideoError(`Failed to load video: ${(e.target as HTMLVideoElement).error?.message || 'Unknown error'}`);
                        setVideoLoaded(false);
                      }}
                      onLoadedData={() => {
                        setVideoLoaded(true);
                        setVideoError(null);
                      }}
                    />
                    
                    {videoError && (
                      <div className="bg-destructive/20 text-destructive p-2 text-sm">
                        {videoError}
                      </div>
                    )}
                    
                    {videoLoaded && (
                      <div className="bg-green-100 text-green-800 p-2 text-sm">
                        Video loaded successfully!
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Direct URL Format</label>
              <div className="flex gap-2">
                <Input
                  value={videoUrl ? videoUrl.replace('/api/media-proxy?url=', '') : ''}
                  readOnly
                  className="flex-1 bg-muted"
                />
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="multi">
          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Alternative URLs to Try</label>
              <Textarea 
                value={alternativeUrls.join('\n')}
                onChange={(e) => setAlternativeUrls(e.target.value.split('\n').filter(line => line.trim()))}
                placeholder="One URL per line to try as video sources"
                className="h-32"
              />
              <Button onClick={testAllUrls} className="mt-2 w-full">
                Test All URLs
              </Button>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold">Working URLs</h3>
              {workingUrls.length > 0 ? (
                <ul className="space-y-2 mt-2">
                  {workingUrls.map((url, i) => (
                    <li key={i} className="bg-green-50 p-2 rounded border border-green-200">
                      <div className="text-sm mb-1 break-all">{url}</div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setVideoUrl(url);
                            setActiveTab('player');
                          }}
                        >
                          Test Direct
                        </Button>
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setVideoUrl(`/api/media-proxy?url=${encodeURIComponent(url)}`);
                            setActiveTab('player');
                          }}
                        >
                          Test Via Proxy
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground text-sm p-4 text-center border rounded mt-2">
                  No working URLs found yet
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="mt-8 bg-muted p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Explanation</h2>
        <p className="text-sm text-muted-foreground">
          This debugging tool helps you identify why media files (especially videos) are not playing correctly. It tests various URL formats
          and uses a server-side proxy to avoid CORS issues. If you find a working URL format, you can use that pattern in your media components.
        </p>
      </div>
    </div>
  );
} 