/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        stacks: {
          purple: '#5546FF',
          'purple-dark': '#3D31B5',
          orange: '#FC6432',
          'orange-dark': '#E04D1A',
          bg: '#0D0D12',
          'bg-secondary': '#14141A',
          'bg-card': '#1A1A24',
          'bg-highlight': '#252533',
          border: '#2A2A3C',
          text: '#FFFFFF',
          'text-muted': '#9191A8',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(85, 70, 255, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(85, 70, 255, 0.6)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

