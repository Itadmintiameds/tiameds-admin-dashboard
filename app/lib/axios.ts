import axios from 'axios';

// Base instances for different backends.

export const pharmaClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_PHARMA_BACKEND_API || 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const labClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_LAB_BACKEND_API || 'https://api-test-aggreator.tiameds.ai',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const marketplaceClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_MARKETPLACE_BACKEND_API || 'https://api-test-aggreator.tiameds.ai/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const sellerClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SELLER_BACKEND_API || 'https://api-test-aggreator.tiameds.ai/api/v1',
  headers: {
    'Content-Type': 'application/json',
    // Add API key from env if available, else hardcode for now as per current codebase
    'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'YOUR_API_KEY'
  },
});

// Interceptors can be added here
pharmaClient.interceptors.request.use((config) => {
  return config;
});
