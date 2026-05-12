import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow large request bodies for file uploads
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
