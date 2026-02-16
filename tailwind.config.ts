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
        navy: '#1e293b',
        grey: '#64748b',
        emerald: '#10b981',
      },
      fontFamily: {
        hebrew: ['Assistant', 'Heebo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config

