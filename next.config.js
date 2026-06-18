/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // pdfkit ships its standard-14 font metrics as .afm data files and
  // loads them from disk at runtime. Next's bundler doesn't trace these
  // (they're read via a runtime path, not a static import), so the
  // dispute-evidence PDF route 500s with ENOENT on Helvetica.afm unless
  // we explicitly include the pdfkit data dir in that route's bundle.
  outputFileTracingIncludes: {
    '/api/admin/disputes/bundle': ['./node_modules/pdfkit/js/data/**/*'],
  },
  // Note: Next.js 14.0 doesn't support `experimental.serverActions.allowedOrigins`.
  // Same-origin enforcement is handled at nginx: the proxy sets
  // `Origin: $scheme://$host` so the framework's origin-vs-host check passes.
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
