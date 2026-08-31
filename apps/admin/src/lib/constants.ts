export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production'
    ? 'https://api.myriderguy.com/api/v1'
    : 'http://localhost:4000/api/v1');
