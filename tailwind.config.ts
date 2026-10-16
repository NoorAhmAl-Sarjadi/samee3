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
          gold: '#A47A3E',
          teal: '#235348',
          dark: '#0F172A',
          border: '#B49763',
        },

        /* ألوان مباشرة مطابقة لـ globals.css */
        samee3: {
          bg: '#FAF8F3',
          primary: '#8A642D',
          primaryDark: '#6F4C1F',
          gold: '#A47A3E',
          paper: '#FCFBF8',
          text: '#0F172A',
          muted: '#64748B',
          border: '#E9E3D8',
          mushafBorder: '#B49763',
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
          '0 4px 18px rgba(138, 100, 45, 0.14)',
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
