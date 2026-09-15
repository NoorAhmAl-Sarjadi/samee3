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
        mushaf: {
          paper: '#FDF7E6', // اللون العاجي/الكريمي لخلفية الورق
          gold: '#C59A53', // الذهبي الفاخر للزخارف
          teal: '#175E67', // الفيروزي/البترولي للأيقونات والزخارف
          dark: '#2A2A2A', // الأسود الناعم للنصوص
          border: '#D8C398' // لون الإطار الخارجي
        }
      },
      fontFamily: {
        cairo: ['var(--font-cairo)', 'sans-serif'], 
        uthmani: ['"KFGQPC Uthmanic Script HAFS"', 'serif'], 
      }
    },
  },
  plugins: [],
}
export default config
