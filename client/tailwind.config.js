/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

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
        // Cinema dark theme — tokens defined as RGB channels in globals.css so /opacity works
        ink: token('ink'), // #0B0F19 background
        panel: token('panel'), // #111827 surface
        'panel-soft': token('panel-soft'),
        line: token('line'),
        'line-soft': token('line-soft'),
        'app-text': token('text'),
        muted: token('muted'),
        accent: {
          DEFAULT: token('accent'), // #6366F1 primary
          soft: token('accent-soft'),
          ink: token('accent-ink'),
        },
        secondary: token('secondary'),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Gabriela"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--accent) / 0.35), 0 10px 40px -10px rgb(var(--accent) / 0.55)',
        stage: '0 30px 80px -20px rgb(0 0 0 / 0.8)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'reaction-float': 'reactionFloat 3.2s cubic-bezier(0.22, 0.61, 0.36, 1) forwards',
        'hero-progress': 'heroProgress 6s linear forwards',
        'ken-burns': 'kenBurns 9s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        heroProgress: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        kenBurns: {
          '0%': { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1.02)' },
        },
        reactionFloat: {
          '0%': { opacity: '0', transform: 'translate(-50%, 0) scale(calc(var(--scale, 1) * 0.4))' },
          '12%': { opacity: '1', transform: 'translate(-50%, -30px) scale(var(--scale, 1))' },
          '70%': { opacity: '0.9' },
          '100%': {
            opacity: '0',
            transform: 'translate(calc(-50% + var(--drift, 0px)), -260px) scale(calc(var(--scale, 1) * 0.9))',
          },
        },
      },
    },
  },
  plugins: [],
};
