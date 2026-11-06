/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm paper surfaces
        paper: '#F5EFE6',
        card: '#FFFCF7',
        sunken: '#EFE8DC',
        line: '#E2D9CB',
        // Ink
        ink: '#1F1A15',
        'ink-soft': '#5E554A',
        'ink-faint': '#8A8174',
        // Mars rust: the one accent colour
        mars: '#B8431F',
        'mars-deep': '#98330F',
        'mars-tint': '#F6E3D9',
        // Status
        moss: '#3E6B4D',
        'moss-tint': '#E3EEE4',
        ochre: '#9A6A12',
        'ochre-tint': '#F6EAC9',
        brick: '#A12B2B',
        'brick-tint': '#F5DEDA',
        sky: '#2F5D86',
        'sky-tint': '#DEE9F3',
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
