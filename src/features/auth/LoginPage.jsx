import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginStart, loginSuccess, loginFailure } from '../../features/auth/authSlice';
import { toast } from 'react-toastify';
import { LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    <div className="min-h-screen flex items-center justify-center bg-space-dark p-4">
      <div className="w-full max-w-md bg-space-deep border border-space-muted/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-space-accent/15 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-8 relative">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-space-accent/10 text-space-accent rounded-2xl mb-4 shadow-inner">
            <LogIn size={32} />
          </div>
          <h1 className="text-3xl font-bold text-space-text tracking-tight">
            {t('auth.welcome_back') || 'Welcome Back'}
          </h1>
          <p className="text-space-muted mt-2 text-sm">
            {t('auth.subtitle') || 'Enter your Mars Space credentials to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative">
          <div>
            <label className="block text-sm font-medium text-space-muted mb-2">
              {t('auth.username') || 'Username'}
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              className="w-full bg-space-dark/80 border border-space-muted/20 rounded-xl px-4 py-3 text-space-text placeholder-space-muted/40 focus:outline-none focus:ring-2 focus:ring-space-accent/50 focus:border-space-accent/60 transition-all text-sm"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="e.g. admin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-space-muted mb-2">
              {t('auth.email_admin_optional') || 'Email (not required for Admin)'}
            </label>
            <input
              type="email"
              autoComplete="email"
              className="w-full bg-space-dark/80 border border-space-muted/20 rounded-xl px-4 py-3 text-space-text placeholder-space-muted/40 focus:outline-none focus:ring-2 focus:ring-space-accent/50 focus:border-space-accent/60 transition-all text-sm"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="name@gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-space-muted mb-2">
              {t('auth.password') || 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="w-full bg-space-dark/80 border border-space-muted/20 rounded-xl px-4 py-3 pr-11 text-space-text placeholder-space-muted/40 focus:outline-none focus:ring-2 focus:ring-space-accent/50 focus:border-space-accent/60 transition-all text-sm"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-space-muted hover:text-space-text transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-space-accent hover:bg-space-accent/90 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-space-accent/25 hover:shadow-space-accent/40 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>{t('auth.login') || 'Sign In'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
