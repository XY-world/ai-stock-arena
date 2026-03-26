/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // No basePath for arena.wade.xylife.net (root deployment)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
    NEXT_PUBLIC_BASE_PATH: '',
  },
};

module.exports = nextConfig;
