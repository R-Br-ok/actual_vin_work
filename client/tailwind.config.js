/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        panel: 'var(--panel)',
        'panel-soft': 'var(--panel-soft)',
        line: 'var(--line)',
        'line-soft': 'var(--line-soft)',
        'app-text': 'var(--text)',
        muted: 'var(--muted)',
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          ink: 'var(--accent-ink)',
        },
        secondary: 'var(--secondary)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        serif: ['"Gabriela"', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'float-up': 'floatUp 2.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        floatUp: {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '50%': { opacity: '0.8', transform: 'translateY(-60px) scale(1.2)' },
          '100%': { opacity: '0', transform: 'translateY(-140px) scale(0.8)' },
        },
      },
    },
  },
  plugins: [],
};
