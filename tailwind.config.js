/** @type {import('tailwindcss').Config} */
// Build-time config for precompiling Tailwind into ./tailwind.css (replaces the
// runtime Play CDN). Mirrors the former inline `tailwind.config` from index.html.
// Regenerate after changing class usage:
//   npx tailwindcss@3.4.17 -c tailwind.config.js -i tailwind.input.css -o tailwind.css --minify
module.exports = {
  content: ['./index.html', './app.js', './js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        germanBlue: '#3b82f6',
        germanPink: '#ec4899',
        germanEmerald: '#10b981',
      },
    },
  },
  plugins: [],
};
