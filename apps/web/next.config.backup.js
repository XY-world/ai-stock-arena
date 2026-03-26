/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/arena',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://arena.wade.xylife.net/api',
  },
};

module.exports = nextConfig;
