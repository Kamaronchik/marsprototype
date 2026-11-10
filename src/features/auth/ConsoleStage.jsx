import { useTranslation } from 'react-i18next';
import Starfield from '../../components/Starfield';
import LoginTools from './LoginTools';

const BOOT_LINES = ['boot1', 'boot2', 'boot3', 'boot4'];

// CONSOLE: a terminal in the dark. Pixel stars drift behind a window that boots line by line
// (each line appears after the previous one), then the form is the prompt.
const ConsoleStage = ({ children }) => {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-24">
      <Starfield count={45} shape="square" color="rgb(var(--mars))" shooting={2} />
      <LoginTools />

      <section className="console-window relative z-10 w-full max-w-lg border border-line bg-card/90">
        <header className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs text-ink-faint">
          <span className="h-2.5 w-2.5 rounded-full bg-brick" /><span className="h-2.5 w-2.5 rounded-full bg-ochre" /><span className="h-2.5 w-2.5 rounded-full bg-moss" />
          <span className="ml-2 font-mono">mars-os ~ login</span>
        </header>

        <ul className="space-y-1 border-b border-line px-5 py-4 font-mono text-xs text-ink-soft">
          {BOOT_LINES.map((line, index) => (
            <li key={line} className="boot-line" style={{ animationDelay: `${0.35 * (index + 1)}s` }}>
              <span className="text-moss">[ ok ]</span> {t(`auth.${line}`)}
            </li>
          ))}
        </ul>

        <div className="p-6 sm:p-8">{children}</div>
      </section>
    </div>
  );
};

export default ConsoleStage;
