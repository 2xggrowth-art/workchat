/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        teal: { DEFAULT: '#075E54', light: '#128C7E' },
        wgreen: { DEFAULT: '#25D366', accent: '#34B7F1' },
        sent: '#DCF8C6',
        chatbg: '#ECE5DD',
        task: {
          pending: '#2196F3',
          progress: '#FFC107',
          completed: '#4CAF50',
          overdue: '#F44336',
          reopened: '#9C27B0',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
