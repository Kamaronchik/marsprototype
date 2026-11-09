import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginStart, loginSuccess, loginFailure } from '../../features/auth/authSlice';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Logo from '../../components/Logo';
import LanguageSwitch from '../../components/LanguageSwitch';
import DesignSwitch from '../../components/DesignSwitch';
import { messageText } from '../../lib/api';
import { useRoleLook } from '../../lib/useRoleLook';

const LoginPage = () => {
  const { t } = useTranslation();
  useRoleLook(null);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((state) => state.auth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { username, email, password } = formData;

    if (!username.trim() || !password) {
      toast.error(t('common.please_fill'));
      return;
    }

    dispatch(loginStart());

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requires2FA) {
          toast.info(data.message ? messageText(t, data.message) : t('auth.codeSent'));
          navigate(`/verify-device?userId=${encodeURIComponent(data.userId)}`);
        } else if (data.user) {
          dispatch(loginSuccess(data.user));
          toast.success(`${t('common.welcome')}, ${data.user.fullName || data.user.username}!`);
          const targetRole = data.user.role?.toLowerCase() || 'student';
          navigate(`/${targetRole}`);
        } else {
          dispatch(loginFailure(t('auth.unexpected')));
          toast.error(t('auth.unexpected'));
        }
      } else {
        const errorMsg = messageText(t, data.message || 'Invalid username or password');
        dispatch(loginFailure(errorMsg));
        toast.error(errorMsg);
      }
    } catch {
      const connMsg = t('auth.connection');
      dispatch(loginFailure(connMsg));
      toast.error(connMsg);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Left: flat brand panel, desktop only */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-mars p-12 text-on-accent lg:flex">
        <Logo inverted />

        <div className="max-w-md">
          <h2 className="font-display text-[2.9rem] font-semibold leading-[1.08] tracking-tight">
            {t('auth.heroTitle')}
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-on-accent/85">
            {t('auth.heroText')}
          </p>
        </div>

        <ul className="space-y-2 border-t border-on-accent/25 pt-6 text-sm text-on-accent/85">
          <li>{t('auth.feature1')}</li>
          <li>{t('auth.feature2')}</li>
          <li>{t('auth.feature3')}</li>
        </ul>

        {/* Big orbit line, purely decorative */}
        <svg
          className="pointer-events-none absolute -bottom-40 -right-40 text-on-accent/15"
          width="520" height="520" viewBox="0 0 520 520" fill="none" aria-hidden="true"
        >
          <circle cx="260" cy="260" r="250" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="260" cy="260" r="170" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </aside>

      {/* Right: the form */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center justify-between">
            <Logo className="lg:hidden" />
            <span className="ml-auto flex items-center gap-4"><DesignSwitch /><LanguageSwitch /></span>
          </div>

          <h1 className="font-display text-[2rem] font-semibold tracking-tight text-ink">
            {t('auth.welcome_back')}
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-soft">
            {t('auth.subtitle')}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="username" className="field-label">
                {t('auth.username')}
              </label>
              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                className="field"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="email" className="field-label">
                {t('auth.email')} <span className="font-normal text-ink-faint">{t('auth.emailAdminSkip')}</span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="field"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@gmail.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="field-label">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  className="field pr-11"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
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

          <p className="mt-8 text-sm leading-relaxed text-ink-faint">
            {t('auth.forgot')}
          </p>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
