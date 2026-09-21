 /** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /*
   * نتجاوز فحص ESLint أثناء next build.
   * الفحص يمكن تشغيله بشكل مستقل عند الحاجة.
   */
  eslint: {
    ignoreDuringBuilds: true,
  },

  /*
   * لا نخفي أخطاء TypeScript.
   * نريد أن يظهر أي خطأ حقيقي في الكود بدل تجاهله.
   */
  typescript: {
    ignoreBuildErrors: false,
  },

  /*
   * المشروع يستخدم useSearchParams() في بعض صفحات App Router.
   * هذا الخيار متاح في Next.js 14.x.
   */
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
}

module.exports = nextConfig
