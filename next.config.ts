import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'googleapis',
    'google-auth-library',
    'gcp-metadata',
    '@google/generative-ai',
  ],
  experimental: {
    // Allow large request bodies for file uploads
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  typescript: {
    // Skip type checking during production builds (we check locally with tsc)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
