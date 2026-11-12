// The looks of the site.
//   Students choose one of three DESIGNS (cockpit, base, console); the choice is remembered.
//   Staff do not choose: the admin always sees "control", the teacher "station", finance "bay".
// A look is a name on <html data-theme="...">; src/index.css defines how it looks and the shells
// (src/shells) define the layout. index.html applies the stored look before the first paint.
export const DESIGNS = ['cockpit', 'base', 'console'];
export const DEFAULT_DESIGN = 'base';

// Which colour set goes with which student design.
const DESIGN_THEME = { cockpit: 'orbit', base: 'mars', console: 'terminal' };
const ROLE_THEME = { Admin: 'control', Teacher: 'station', Financier: 'bay', AcademicManager: 'station' };

const THEME_KEY = 'mars-theme';   // the look on the page now (read by index.html)
const DESIGN_KEY = 'mars-design'; // the student's own choice

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: the look still changes, it just will not be remembered.
  }
};

export const savedDesign = () => {
  const name = read(DESIGN_KEY);
  return DESIGNS.includes(name) ? name : DEFAULT_DESIGN;
};

// Only the display font of the look on the screen is downloaded, not all six.
// (Inter and JetBrains Mono are loaded by index.html.)
const THEME_FONT = {
  mars: 'Fraunces:opsz,wght@9..144,500;9..144,600',
  orbit: 'Exo+2:wght@500;600;700',
  control: 'IBM+Plex+Sans:wght@500;600;700',
  station: 'Manrope:wght@600;700;800',
  bay: 'Roboto+Slab:wght@500;600;700',
};
const loadedFonts = new Set();

export const loadThemeFont = (theme = 'mars') => {
  const family = THEME_FONT[theme];
  if (!family || loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
  document.head.appendChild(link);
};

const showTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  write(THEME_KEY, theme);
  loadThemeFont(theme);
};

// Screens that show the design (the shells) listen to this.
const CHANGED = 'mars-design-changed';

export const subscribeToDesign = (callback) => {
  window.addEventListener(CHANGED, callback);
  return () => window.removeEventListener(CHANGED, callback);
};

// A student picks a design.
export const chooseDesign = (design) => {
  if (!DESIGNS.includes(design)) return;
  write(DESIGN_KEY, design);
  showTheme(DESIGN_THEME[design]);
  window.dispatchEvent(new Event(CHANGED));
};

// Called when someone opens their part of the site: staff get their own look, students their saved design.
// Nobody signed in (the login page) shows the student's saved design.
export const applyRoleLook = (role) => {
  showTheme(ROLE_THEME[role] ?? DESIGN_THEME[savedDesign()]);
};
