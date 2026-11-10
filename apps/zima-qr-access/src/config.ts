export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export const APP_ENV = process.env.EXPO_PUBLIC_ENV ?? 'development';
