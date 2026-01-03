/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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
    // Prevent caching of HTML pages to avoid stale deployments
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-store, must-revalidate',
        },
      ],
    },
  ],
};

module.exports = nextConfig;
