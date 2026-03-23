/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        szured: '#8A1538', // Lichee red
        szuredDark: '#670A25',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
