import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Allow builds to succeed even with ESLint warnings/errors
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ✅ Allow builds to succeed even with TypeScript errors
  typescript: {
    ignoreBuildErrors: true,
  },

  // ✅ Turbopack root (prevents monorepo / path warnings)
  turbopack: {
    root: __dirname,
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
    }

    // Ignore warnings from dynamic imports
    config.ignoreWarnings = config.ignoreWarnings || [];
    config.ignoreWarnings.push(
      /Critical dependency: the request of a dependency is an expression/,
      /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/
    );
    
    return config;
  },

  // 🔐 Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
