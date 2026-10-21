import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: { xs: '480px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px', short: { raw: '(max-height: 500px)' } },
    extend: {
      colors: {
        brand: { DEFAULT: '#f28c28', dark: '#d9741a' },
        teb: { DEFAULT: '#2f6fd0', dark: '#2458a8' },
        panel: { DEFAULT: 'rgba(38,32,28,0.88)', solid: '#2a2420' },
        gem: '#2ecc71',
        coin: '#f5b82e',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        sans: ['Barlow', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
