import ky from "ky";

// Create a custom ky instance with better timeout and error handling
const kyInstance = ky.create({
  // Increase timeout to 30 seconds
  timeout: 30000,
  
  // Always include credentials (cookies)
  credentials: 'include',
  
  // Add custom retry logic
  retry: {
    limit: 3,
    methods: ['get'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
    backoffLimit: 10000,
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
        console.log(`Retrying request (${retryCount}/3): ${request.url}`);
      }
    ],
    beforeError: [
      async (error) => {
        if (error.name === 'TimeoutError') {
          console.error('Request timed out - returning empty data');
          
          // Override the response with empty data instead of throwing
          const customResponse = new Response(JSON.stringify({
            posts: [],
            nextCursor: null,
            _clientError: 'timeout'
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
