import { useTranslation } from 'react-i18next';
import Starfield from '../../components/Starfield';
import Planet from '../../components/Planet';
import Eyebrow from '../../components/Eyebrow';
import LoginTools from './LoginTools';

// COCKPIT: the pilot's seat. A deep night with twinkling stars and shooting stars, Mars rising in the
// corner behind two slow orbit rings, and the form on a glass panel with HUD marks at the corners.
const CockpitStage = ({ children }) => {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-24">
      <Starfield count={130} shooting={3} />
      <Planet className="planet-corner" size="42rem" />

      <svg className="orbit-rings pointer-events-none absolute -bottom-[26rem] -right-[18rem] text-mars/40" width="1100" height="1100" viewBox="0 0 1100 1100" fill="none" aria-hidden="true">
        <circle cx="550" cy="550" r="520" stroke="currentColor" strokeWidth="1" strokeDasharray="2 10" />
        <circle cx="550" cy="550" r="430" stroke="currentColor" strokeWidth="1" />
        <circle cx="930" cy="330" r="7" fill="currentColor" />
      </svg>

      <LoginTools />

      <section className="cockpit-panel relative z-10 w-full max-w-md rounded-2xl border border-line bg-card/70 p-8 backdrop-blur-md">
        <span className="hud-mark hud-tl" /><span className="hud-mark hud-tr" /><span className="hud-mark hud-bl" /><span className="hud-mark hud-br" />
        <div className="mb-6"><Eyebrow>{t('auth.launchPad')}</Eyebrow></div>
        {children}
      </section>

      <p className="absolute bottom-5 left-5 z-10 hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint md:flex">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-moss" /> {t('auth.systemsNominal')}
      </p>
    </div>
  );
};

export default CockpitStage;
