/**
 * Get the base URL for API calls
 * Used for server-side fetch calls where relative URLs are not supported
 */
export function getBaseUrl(): string {
  // Browser context - use relative URLs
  if (typeof window !== 'undefined') {
    return '';
  }

  // Server context - need absolute URL
  
  // 1. Check for explicit app URL (works in all environments)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 2. Vercel deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 3. Development fallback
  return 'http://localhost:3000';
}

