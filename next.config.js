/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Required for sharp in serverless environments
    serverComponentsExternalPackages: ['sharp'],
  },
};

module.exports = nextConfig;

