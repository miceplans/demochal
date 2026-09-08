import { createApiClient } from '@semochal/api-client';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// The single API entry point for the entire front app.
// Components must import `api` (or feature hooks built on it) — never fetch()
// the server directly, so that base URL / auth headers stay in one place.
export const api = createApiClient({
  baseUrl,
  getAuthToken: () => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('accessToken');
  },
});
