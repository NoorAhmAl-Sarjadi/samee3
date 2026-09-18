/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  experimental: {
    missingSuspenseWithCSRBailout: false,
    serverComponentsExternalPackages: ['@quran.ws/text'],
  },
}

module.exports = nextConfig
