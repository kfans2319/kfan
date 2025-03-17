import ky from "ky";

// Create a custom ky instance with better timeout and error handling
const kyInstance = ky.create({
  // Increase timeout to 60 seconds to address timeout issues
  timeout: 60000,
  
  // Always include credentials (cookies)
  credentials: 'include',
  
  // Improve retry logic with more attempts
  retry: {
    limit: 5,
    methods: ['get', 'post'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
    backoffLimit: 15000,
  },
  
  // Add default headers for all requests
  headers: {
    'x-requested-with': 'fetch',
  },
  
  // Hooks for better error handling
  hooks: {
    beforeRequest: [
      async (request) => {
        // Add a cache busting parameter to ALL requests
        const url = new URL(request.url);
        url.searchParams.append('_t', Date.now().toString());
        
        // Add specific auth flags if present
        if (request.headers.has('x-client-auth')) {
          url.searchParams.append('_auth', Date.now().toString());
        }
        request = new Request(url.toString(), request);
        
        return request;
      }
    ],
    beforeRetry: [
      async ({ request, options, error, retryCount }) => {
        console.log(`Retrying request (${retryCount}/5): ${request.url}`);
        // Add increasing delay between retries
        const delay = Math.min(1000 * (retryCount + 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    ],
    beforeError: [
      async (error) => {
        if (error.name === 'TimeoutError') {
          console.error('Request timed out - returning empty data');
          
          // Override the response with empty data instead of throwing
          const customResponse = new Response(JSON.stringify({
            posts: [],
            users: [],
            messages: [],
            nextCursor: null,
            _clientError: 'timeout',
            message: 'The request timed out. Please try again later or refresh the page.'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          // Replace the error's response with our custom one
          error.response = customResponse;
        } else if (error.response?.status === 401) {
          console.error('Authentication error - user may need to log in again');
          
          // For auth errors, provide a clear message
          const customResponse = new Response(JSON.stringify({
            posts: [],
            nextCursor: null,
            _clientError: 'auth',
            message: 'Authentication failed. Please refresh the page or log in again.'
          }), {
            status: 200, // Return 200 to prevent cascading failures
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          error.response = customResponse;
        } else if (error.name === 'NetworkError' || error.message?.includes('network') || error.message?.includes('connection')) {
          console.error('Network error detected - returning graceful error response');
          
          // For network errors, provide a helpful message
          const customResponse = new Response(JSON.stringify({
            posts: [],
            nextCursor: null,
            _clientError: 'network',
            message: 'Network connection issue detected. Please check your internet connection and try again.'
          }), {
            status: 200, // Return 200 to prevent cascading failures
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          error.response = customResponse;
        }
        return error;
      }
    ]
  },
  
  // Custom parser to handle dates
  parseJson: (text) =>
    JSON.parse(text, (key, value) => {
      if (key.endsWith("At")) return new Date(value);
      return value;
    }),
});

export default kyInstance;
