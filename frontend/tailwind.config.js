/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Spotify-like dark theme with blue accent
        dark: {
          900: '#0a0a0a',
          800: '#121212',
          700: '#1a1a1a',
          600: '#232323',
          500: '#2a2a2a',
          400: '#333333',
          300: '#404040',
          200: '#535353',
          100: '#727272',
        },
        accent: {
          DEFAULT: '#1e90ff',
          light: '#4da6ff',
          dark: '#0066cc',
          50: '#e6f3ff',
          100: '#b3daff',
          200: '#80c1ff',
          300: '#4da8ff',
          400: '#1a8fff',
          500: '#1e90ff',
          600: '#0077e6',
          700: '#005cb3',
          800: '#004080',
          900: '#00264d',
        },
      },
    },
  },
  plugins: [],
}
