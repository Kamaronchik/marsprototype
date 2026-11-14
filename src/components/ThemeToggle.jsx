import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { currentMode, chooseMode, subscribeToMode } from '../lib/theme';

// One button: light or dark mode.
const ThemeToggle = () => {
  const { t } = useTranslation();
  const mode = useSyncExternalStore(subscribeToMode, currentMode, () => 'light');
  const next = mode === 'dark' ? 'light' : 'dark';
  const label = t(next === 'dark' ? 'theme.dark' : 'theme.light');

  return (
    <button
      onClick={() => chooseMode(next)}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card text-ink-soft hover:bg-sunken hover:text-ink"
    >
      {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
};

export default ThemeToggle;
