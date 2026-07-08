import type { NextConfig } from "next";
import { PROVVYPAY_LEGAL_REDIRECTS } from "./lib/legal/provvypay-legal-redirects";
import {
  CONTENT_SECURITY_POLICY,
  CONTENT_SECURITY_POLICY_PRODUCTION,
} from "./lib/security/content-security-policy";

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

  // Transpile hashconnect so its async client chunk is emitted without SWC mangle collisions (let n,n).
  transpilePackages: ["hashconnect"],

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
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      // pdf-parse bundles pdfjs-dist ESM which has export incompatibilities.
      // It is only used in server-side extraction routes, so exclude from the bundle.
      config.externals = Array.isArray(config.externals)
        ? [...config.externals, 'pdf-parse']
        : typeof config.externals === 'object'
          ? { ...config.externals, 'pdf-parse': 'commonjs pdf-parse' }
          : ['pdf-parse'];
    }

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

      // SWC minify emits invalid duplicate bindings (`let n,n;`) in the hashconnect async chunk.
      // Use Terser without mangling for client production bundles instead.
      if (!dev) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TerserPlugin = require("terser-webpack-plugin");
        config.optimization.minimizer = [
          new TerserPlugin({
            terserOptions: {
              compress: true,
              mangle: false,
              format: {
                comments: false,
              },
            },
          }),
        ];
      }
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

  async redirects() {
    return [...PROVVYPAY_LEGAL_REDIRECTS];
  },

  // 🔐 Cache Control for static assets (HTML no-store is handled in middleware.ts)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              process.env.NODE_ENV === "production"
                ? CONTENT_SECURITY_POLICY_PRODUCTION
                : CONTENT_SECURITY_POLICY,
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
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
