/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rosew: {
          50: '#fff8f7',
          100: '#fdecea',
          200: '#f7d8d3',
          300: '#edbdb5',
          400: '#d8948b',
          500: '#bd746d'
        },
        champagne: '#f5ead8',
        goldsoft: '#c8a86a',
        olivew: '#9faa83',
        ink: '#39312e'
      },
      boxShadow: {
        soft: '0 18px 45px rgba(92, 64, 51, 0.09)'
      }
    }
  },
  plugins: []
};
