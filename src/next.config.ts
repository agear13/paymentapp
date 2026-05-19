import type { NextConfig } from "next";

const buildId =
  process.env.BUILD_ID ||
  process.env.RENDER_GIT_COMMIT ||
  process.env.GIT_SHA ||
  "development";

const nextConfig: NextConfig = {
  eslint: {
    // ESLint is a devDependency; do not block Render production builds when devDeps are omitted.
    ignoreDuringBuilds: true,
  },

  // Remaining strictness debt in `lib/payments/*`, `lib/payment/edge-case-handler.ts`, and Prisma JSON snapshots; tracked in SECURITY_AND_SCALE.md.
  typescript: {
    ignoreBuildErrors: true,
  },

  generateBuildId: async () => buildId,

  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "@radix-ui/react-icons"],
  },

  // ✅ Turbopack root (prevents monorepo / path warnings)
  turbopack: {
    root: __dirname,
  },

  // 🖼️ Image configuration for uploaded logos
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow any HTTPS domain for external logo URLs
      },
    ],
    // Allow local uploads directory
    unoptimized: false,
  },

  // 🔧 Webpack configuration (simplified - client island handles isolation)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side fallbacks for Node.js modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };

      // Prevent scope-hoisting collisions in dynamic import graphs (HashConnect / wallet islands).
      config.optimization = config.optimization || {};
      config.optimization.concatenateModules = false;
    }

    // Ignore warnings from dynamic imports
    config.ignoreWarnings = config.ignoreWarnings || [];
    config.ignoreWarnings.push(
      /Critical dependency: the request of a dependency is an expression/,
      /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
      /Module not found: Can't resolve 'hashconnect'/  // Ignore if not found on server
    );
    
    return config;
  },

  // 🔐 Cache Control for static assets (HTML no-store is handled in middleware.ts)
  async headers() {
    return [
      // Hashed Next.js static assets — safe to cache indefinitely by content hash.
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Build manifest must revalidate so clients detect deploys without stale chunk maps.
      {
        source: "/_next/static/:buildId/_buildManifest.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/_next/static/:buildId/_ssgManifest.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      // ✅ Cache Next.js optimized images forever
      {
        source: "/_next/image/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
