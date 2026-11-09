/** @type {import('tailwindcss').Config} */

// Every colour is a CSS variable holding "R G B", so a style (theme) is only a different set of
// variables on <html data-theme="...">; see src/index.css. The "<alpha-value>" part keeps
// classes like bg-card/70 working.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        paper: token('paper'),
        card: token('card'),
        sunken: token('sunken'),
        line: token('line'),
        // Ink
        ink: token('ink'),
        'ink-soft': token('ink-soft'),
        'ink-faint': token('ink-faint'),
        // The accent of the style (rust in Mars, violet in Orbit, green in Terminal)
        mars: token('mars'),
        'mars-deep': token('mars-deep'),
        'mars-tint': token('mars-tint'),
        // Text that sits on the accent colour
        'on-accent': token('on-accent'),
        // Status
        moss: token('moss'),
        'moss-tint': token('moss-tint'),
        ochre: token('ochre'),
        'ochre-tint': token('ochre-tint'),
        brick: token('brick'),
        'brick-tint': token('brick-tint'),
        sky: token('sky'),
        'sky-tint': token('sky-tint'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // Corners and shadows change with the style too (Terminal is sharp, Orbit is round).
      borderRadius: {
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
      },
      boxShadow: {
        xl: 'var(--shadow-xl)',
      },
    },
  },
  plugins: [],
}
