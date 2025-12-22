/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure proper cache invalidation on deployments
  generateBuildId: async () => {
    // Use timestamp for unique build IDs
    return `build-${Date.now()}`;
  },
  // Add cache headers for static assets
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on',
        },
      ],
    },
  ],
};

module.exports = nextConfig;
