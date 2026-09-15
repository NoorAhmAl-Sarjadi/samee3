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
          paper: '#FDF7E6',
          gold: '#C59A53',
          teal: '#175E67',
          dark: '#2A2A2A',
          border: '#D8C398'
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
