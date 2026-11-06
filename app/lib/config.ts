// Marketplace (seller / buyer / lab) API base URL. Same-origin /api/v1 is proxied to the gateway by app/api/v1/[...path]/route.ts.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// Admin backend (tiameds-admin): auth, pharmacy registration. Separate service from the marketplace gateway.
// NEXT_PUBLIC_ADMIN_API / NEXT_PUBLIC_AUTH_BACKEND_API are the names the dashboard used before; kept so existing deployments don't break.
export const ADMIN_API_URL =
  process.env.NEXT_PUBLIC_ADMIN_API_URL ||
  process.env.NEXT_PUBLIC_ADMIN_API ||
  process.env.NEXT_PUBLIC_AUTH_BACKEND_API ||
  'http://localhost:8081/api/v1';

// Recorded as approvedBy / reviewedBy on seller and buyer approve/reject calls.
export const REVIEWER = process.env.NEXT_PUBLIC_REVIEWER || 'admin@tiameds.ai';
