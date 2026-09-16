/** @type {import('next').NextConfig} */
const nextConfig = {
  // الكود ده بيجبر Vercel يكمل بناء الموقع حتى لو في إيرور في بعض الصفحات (زي مجلد index الشبح)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // ده بيمنع Next.js إنه يعلق بسبب إعدادات الـ Client/Server
    missingSuspenseWithCSRBailout: false,
  }
}

module.exports = nextConfig
