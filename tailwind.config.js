/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Poppins"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'page': '0 4px 20px rgba(0, 0, 0, 0.06)',
        'float': '0 8px 28px rgba(109, 40, 217, 0.10), 0 2px 6px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
};
