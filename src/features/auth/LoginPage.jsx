import { useTranslation } from 'react-i18next';
import LoginForm from './LoginForm';
import LoginTools from './LoginTools';

// The login screen: a welcome on the left and the form on a card.
const LoginPage = () => {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-screen items-center overflow-hidden">
      <LoginTools />
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-12 pt-24 lg:grid-cols-[1.1fr_1fr] lg:px-10">
        <div className="hidden lg:block">
          <h2 className="font-display text-[3.2rem] font-semibold leading-[1.06] tracking-tight text-ink">{t('auth.heroTitle')}</h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft">{t('auth.heroText')}</p>
        </div>
        <section className="w-full max-w-md justify-self-center rounded-2xl border border-line bg-card p-8 shadow-xl lg:justify-self-end">
          <LoginForm />
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
