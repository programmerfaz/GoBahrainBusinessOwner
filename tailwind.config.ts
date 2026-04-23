import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      keyframes: {
        'gb-listing-marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'gb-listing-marquee': 'gb-listing-marquee 32s linear infinite',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'gb-card': 'var(--shadow-md)',
        'gb-glow': 'var(--shadow-glow)',
      },
      borderRadius: {
        gb: 'var(--radius)',
        'gb-lg': 'var(--radius-lg)',
        'gb-xl': 'var(--radius-xl)',
      },
    },
  },
  plugins: [],
} satisfies Config
