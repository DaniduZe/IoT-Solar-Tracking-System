/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#020617', // Very dark for background
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
        },
        brand: {
          blue: '#3b82f6',
          green: '#22c55e',
          red: '#ef4444',
          yellow: '#eab308'
        }
      },
      animation: {
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'flash-warning': 'flashWarning 1s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        flashWarning: {
          '0%, 100%': { backgroundColor: 'rgba(59, 130, 246, 0.2)' },
          '50%': { backgroundColor: 'rgba(239, 68, 68, 0.4)' },
        }
      }
    },
  },
  plugins: [],
}
