import axios from 'axios';

// Base instances for different backends.
// This is designed so future seller, buyer, and lab requests can also be migrated here easily.

export const pharmaClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_PHARMA_BACKEND_API || 'http://localhost:8080',
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
  baseURL: process.env.NEXT_PUBLIC_MARKETPLACE_BACKEND_API || 'https://api-test-aggreator.tiameds.ai',
  headers: {
    'Content-Type': 'application/json',
  },
});

// You can add interceptors here later for authentication tokens
pharmaClient.interceptors.request.use((config) => {
  // If an API key or token is needed, attach it here
  // config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});
