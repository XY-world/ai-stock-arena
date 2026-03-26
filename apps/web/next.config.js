/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/arena',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/arena/api',
    NEXT_PUBLIC_BASE_PATH: '/arena',
  },
};

module.exports = nextConfig;
