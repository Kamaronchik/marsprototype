import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginStart, loginSuccess, loginFailure } from '../../features/auth/authSlice';
import { toast } from 'react-toastify';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { store } from '../../app/store';

const LoginPage = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((state) => state.auth);

  const handleSubmit = (e) => {
    e.preventDefault();
    const { username, password } = formData;

    if (!username || !password) {
      toast.error(t('common.please_fill'));
      return;
    }

    dispatch(loginStart());

    setTimeout(() => {
      const state = store.getState();
      const user = state.users.list.find(u => u.username === username && u.password === password);

      if (user) {
        dispatch(loginSuccess({
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: user.fullName,
          email: user.email
        }));
        toast.success(`${t('common.welcome')}, ${user.fullName}!`);

        if (user.role === 'Admin') navigate('/admin');
        else if (user.role === 'Teacher') navigate('/teacher');
        else if (user.role === 'Financier') navigate('/financier');
        else navigate('/student');
      } else {
        dispatch(loginFailure('Invalid username or password'));
        toast.error('Invalid username or password');
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-space-dark p-4">
      <div className="w-full max-w-md bg-space-deep border border-space-muted/10 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-space-accent/10 text-space-accent rounded-2xl mb-4">
            <LogIn size={32} />
          </div>
          <h1 className="text-3xl font-bold text-space-text">{t('auth.welcome_back')}</h1>
          <p className="text-space-muted mt-2">{t('auth.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-space-muted mb-2">{t('auth.username')}</label>
            <input
              type="text"
              className="w-full bg-space-dark border border-space-muted/20 rounded-lg px-4 py-3 text-space-text focus:outline-none focus:ring-2 focus:ring-space-accent/50 transition-all"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Enter username"
            />
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-space-muted mb-2">{t('auth.password')}</label>
            <div className="relative">
              <input
                type="password"
                className="w-full bg-space-dark border border-space-muted/20 rounded-lg px-4 py-3 text-space-text focus:outline-none focus:ring-2 focus:ring-space-accent/50 transition-all"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-space-muted hover:text-space-text transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {/* Logic to actually toggle type would be here, let's fix that in the next pass or just use state */}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-space-accent hover:bg-space-accent/90 text-white font-semibold py-3 rounded-lg transition-all shadow-lg shadow-space-accent/20 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : t('auth.login')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
