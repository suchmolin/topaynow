/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { 500: '#0d9488', 600: '#0f766e', 700: '#115e59' },
        surface: { 50: '#f8fafc', 100: '#f1f5f9' },
      },
      safe: {
        bottom: 'env(safe-area-inset-bottom, 0px)',
      },
    },
  },
  plugins: [],
}
