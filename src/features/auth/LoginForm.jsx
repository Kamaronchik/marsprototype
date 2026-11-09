import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLogin } from '../../lib/useLogin';

// The login form: the same fields in every design, it takes its colours from the theme around it.
const LoginForm = () => {
  const { t } = useTranslation();
  const { formData, setField, showPassword, toggleShowPassword, loading, handleSubmit } = useLogin();

  return (
    <>
      <h1 className="font-display text-[1.9rem] font-semibold tracking-tight text-ink">{t('auth.welcome_back')}</h1>
      <p className="mt-1.5 text-[15px] text-ink-soft">{t('auth.subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        <div>
          <label htmlFor="username" className="field-label">{t('auth.username')}</label>
          <input id="username" type="text" required autoComplete="username" className="field" value={formData.username} onChange={setField('username')} />
        </div>

        <div>
          <label htmlFor="email" className="field-label">
            {t('auth.email')} <span className="font-normal text-ink-faint">{t('auth.emailAdminSkip')}</span>
          </label>
          <input id="email" type="email" autoComplete="email" className="field" value={formData.email} onChange={setField('email')} placeholder="name@gmail.com" />
        </div>

        <div>
          <label htmlFor="password" className="field-label">{t('auth.password')}</label>
          <div className="relative">
            <input id="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" className="field pr-11" value={formData.password} onChange={setField('password')} />
            <button
              type="button"
              onClick={toggleShowPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-faint hover:text-ink"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={17} />
              <span>{t('auth.signingIn')}</span>
            </>
          ) : (
            <span>{t('auth.login')}</span>
          )}
        </button>
      </form>

      <p className="mt-7 text-sm leading-relaxed text-ink-faint">{t('auth.forgot')}</p>
    </>
  );
};

export default LoginForm;
