import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginStart, loginSuccess, loginFailure } from '../../features/auth/authSlice';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Logo from '../../components/Logo';

const LoginPage = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((state) => state.auth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { username, email, password } = formData;

    if (!username.trim() || !password) {
      toast.error(t('common.please_fill') || 'Please fill in all fields');
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
          toast.info(data.message || 'Verification code sent to your email');
          navigate(`/verify-device?userId=${encodeURIComponent(data.userId)}`);
        } else if (data.user) {
          dispatch(loginSuccess(data.user));
          toast.success(`${t('common.welcome') || 'Welcome back'}, ${data.user.fullName || data.user.username}!`);
          const targetRole = data.user.role?.toLowerCase() || 'student';
          navigate(`/${targetRole}`);
        } else {
          dispatch(loginFailure('Unexpected server response'));
          toast.error('Unexpected server response');
        }
      } else {
        const errorMsg = data.message || 'Invalid username or password';
        dispatch(loginFailure(errorMsg));
        toast.error(errorMsg);
      }
    } catch {
      const connMsg = 'Server connection error. Please try again later.';
      dispatch(loginFailure(connMsg));
      toast.error(connMsg);
    }
  };

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[1.05fr_1fr]">
      {/* Left: flat brand panel, desktop only */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-mars p-12 text-card lg:flex">
        <Logo inverted />

        <div className="max-w-md">
          <h2 className="font-display text-[2.9rem] font-semibold leading-[1.08] tracking-tight">
            Good to see you again.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-card/85">
            Groups, attendance and payments for the whole school, kept in one calm place.
          </p>
        </div>

        <ul className="space-y-2 border-t border-card/25 pt-6 text-sm text-card/85">
          <li>Teachers take attendance in a couple of taps.</li>
          <li>Students see their schedule and courses.</li>
          <li>Finance sees who has paid and who has not.</li>
        </ul>

        {/* Big orbit line, purely decorative */}
        <svg
          className="pointer-events-none absolute -bottom-40 -right-40 text-card/15"
          width="520" height="520" viewBox="0 0 520 520" fill="none" aria-hidden="true"
        >
          <circle cx="260" cy="260" r="250" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="260" cy="260" r="170" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </aside>

      {/* Right: the form */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />

          <h1 className="font-display text-[2rem] font-semibold tracking-tight text-ink">
            {t('auth.welcome_back') || 'Welcome back'}
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-soft">
            {t('auth.subtitle') || 'Sign in with the account your school gave you.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="username" className="field-label">
                {t('auth.username') || 'Username'}
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
                Email <span className="font-normal text-ink-faint">(admins can skip this)</span>
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
                {t('auth.password') || 'Password'}
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
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={17} />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>{t('auth.login') || 'Sign in'}</span>
              )}
            </button>
          </form>

          <p className="mt-8 text-sm leading-relaxed text-ink-faint">
            Forgot your password? Ask your administrator to reset it.
          </p>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
