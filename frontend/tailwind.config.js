/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'pahang-yellow': '#FCD116',
        'pahang-black': '#000000',
        'pahang-white': '#FFFFFF',
      }
    },
  },
  plugins: [
    require('tailwindcss-animate')
  ],
}
