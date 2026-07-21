/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkE: '#0B3D2E',
        emerald: '#0E5C44',
        accent: '#127A5A',
        bright: '#1D9E75',
        pale: '#DDF0E7',
        gold: '#C79A2E',
        darkgold: '#8A6516',
        goldfill: '#FBF4E2',
        red: '#B23B2E',
        redfill: '#F7E7E3',
        purple: '#6B3FA0',
        purplefill: '#F1E9F5',
        lowconftext: '#5B6066',
        body: '#2C2C2A',
        muted: '#6B6F73',
        line: '#E7EAE8',
        canvas: '#EEF1EF',
      },
      fontFamily: {
        sans: ['Aptos', 'Segoe UI', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
