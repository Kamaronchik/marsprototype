import { useTranslation } from 'react-i18next';
import Starfield from '../../components/Starfield';
import Horizon from '../../components/Horizon';
import LoginTools from './LoginTools';

// MARS BASE: a night over the colony. A dark sky with stars falls into the Martian dusk of the horizon
// at the bottom (the rover drives across it), a welcome on the left and the form on a warm card.
const BaseStage = ({ children }) => {
  const { t } = useTranslation();

  return (
    <div className="base-sky relative flex min-h-screen items-center overflow-hidden">
      <Starfield count={50} shooting={2} className="!bottom-[30%]" />
      <Horizon className="horizon-fade pointer-events-none absolute inset-x-0 bottom-0 h-[34vh] min-h-[14rem] w-full" />

      <LoginTools onLightText />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-[9vh] pt-24 lg:grid-cols-[1.1fr_1fr] lg:px-10">
        <div className="hidden text-[#fbeee0] lg:block">
          <h2 className="font-display text-[3.2rem] font-semibold leading-[1.06] tracking-tight">{t('auth.heroTitle')}</h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#fbeee0]/80">{t('auth.heroText')}</p>
        </div>
        <section className="w-full max-w-md justify-self-center rounded-2xl border border-line bg-card p-8 shadow-[0_30px_80px_rgba(10,4,20,0.55)] lg:justify-self-end">
          {children}
        </section>
      </div>
    </div>
  );
};

export default BaseStage;
