import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    extend: {
      colors: {
        /*
         * هوية مصحف سميع
         * تم الإبقاء على أسماء mushaf القديمة
         * حتى لا تتعطل الملفات الحالية التي تستخدمها.
         */
        mushaf: {
          paper: '#FCFBF8',
          gold: '#D97706',
          teal: '#0284C7',
          dark: '#0F172A',
          border: '#0EA5E9',
        },

        /* ألوان مباشرة مطابقة لـ globals.css */
        samee3: {
          bg: '#F4F9FE',
          primary: '#0284C7',
          primaryDark: '#0369A1',
          gold: '#D97706',
          paper: '#FCFBF8',
          text: '#0F172A',
          muted: '#64748B',
          border: '#E2E8F0',
          mushafBorder: '#0EA5E9',
        },
      },

      fontFamily: {
        /*
         * لا نعتمد على متغير غير موجود في layout.
         * Tajawal هو الخط الأساسي للواجهة.
         */
        cairo: ['Tajawal', 'sans-serif'],
        tajawal: ['Tajawal', 'sans-serif'],

        /*
         * خط المصحف العثماني.
         */
        uthmani: ['"KFGQPC Uthmanic Script HAFS"', 'serif'],

        /*
         * خطوط عربية بديلة للاستخدام في العناوين.
         */
        arabic: ['Tajawal', 'Arial', 'sans-serif'],
      },

      boxShadow: {
        'mushaf':
          '0 10px 30px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.05)',

        'floating-nav':
          '0 10px 35px rgba(15, 23, 42, 0.12)',

        'soft-blue':
          '0 4px 18px rgba(2, 132, 199, 0.14)',
      },

      borderRadius: {
        mushaf: '18px',
        floating: '24px',
      },
    },
  },

  plugins: [],
}

export default config
