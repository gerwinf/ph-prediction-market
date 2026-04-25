import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand': {
          'bg': '#0A0A0B',
          'surface': '#141417',
          'border': '#222226',
          'text-primary': '#FAFAFA',
          'text-secondary': '#8A8A92',
          'accent': '#F4B942',
          'success': '#10B981',
          'danger': '#EF4444',
        }
      },
      fontFamily: {
        'serif': ['var(--font-fraunces)'],
        'sans': ['var(--font-geist-sans)'],
        'mono': ['var(--font-geist-mono)'],
      },
      borderRadius: {
        'card': '12px',
        'btn': '8px',
        'input': '6px',
      },
      spacing: {
        'mobile-p': '16px',
        'desktop-p': '24px',
      },
      letterSpacing: {
        'tight': '-0.02em',
      }
    },
  },
  plugins: [],
}
export default config
