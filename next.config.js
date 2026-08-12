/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudflare.com',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
