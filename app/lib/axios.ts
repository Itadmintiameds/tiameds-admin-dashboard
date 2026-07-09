import axios from 'axios';

// Base instances for different backends.

// export const pharmaClient = axios.create({
//   baseURL: process.env.NEXT_PUBLIC_PHARMA_BACKEND_API || 'http://localhost:8080/api/v1',
//   headers: {
//     'Content-Type': 'application/json',
//   },
//   withCredentials: true,
// });

// export const labClient = axios.create({
//   baseURL: process.env.NEXT_PUBLIC_LAB_BACKEND_API || 'https://api-test-aggreator.tiameds.ai',
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// export const buyerClient = axios.create({
//   baseURL: process.env.NEXT_PUBLIC_MARKETPLACE_BUYER_API || 'https://api-test-aggreator.tiameds.ai/api/v1',
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

export const sellerClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_MARKETPLACE_SELLER_API || 'https://api-test-aggreator.tiameds.ai/api/v1',
  headers: {
    'Content-Type': 'application/json',
    // Add API key from env if available, else hardcode for now as per current codebase
    'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'YOUR_API_KEY'
  },
  withCredentials: true,
});

export const adminClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_ADMIN_API || process.env.NEXT_PUBLIC_AUTH_BACKEND_API || 'http://localhost:8081/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Global Response Interceptor for Token Refresh
const setupInterceptors = (client: any) => {
  client.interceptors.response.use(
    (response: any) => response,
    async (error: any) => {
      const originalRequest = error.config;
      
      // If unauthorized (401) and not already retried
      if (error.response?.status === 401 && !originalRequest._retry) {
        // Don't intercept refresh token calls themselves to avoid infinite loops
        if (originalRequest.url?.includes('/auth/refresh')) {
          return Promise.reject(error);
        }
        
        originalRequest._retry = true;
        
        try {
          // Attempt to get a new access token using the HttpOnly refresh token cookie
          await adminClient.post('/auth/refresh');
          
          // Retry the original failed request
          return client(originalRequest);
        } catch (refreshError) {
          // If refresh fails, user must log in again
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    }
  );
};

// setupInterceptors(pharmaClient);
setupInterceptors(sellerClient);
setupInterceptors(adminClient);
