/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // 无 basePath - 用于 arena.wade.xylife.net 根域名部署
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://arena.wade.xylife.net/api',
  },
};

module.exports = nextConfig;
