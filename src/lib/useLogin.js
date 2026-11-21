import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { loginStart, loginSuccess, loginFailure } from '../features/auth/authSlice';
import { messageText } from './api';
import { homePath } from './roleHome';

// The login logic, shared by the three login screens: the fields, the request and what happens next.
export const useLogin = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((state) => state.auth);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const setField = (name) => (event) => setFormData((current) => ({ ...current, [name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
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
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requires2FA) {
          toast.info(data.message ? messageText(t, data.message) : t('auth.codeSent'));
          navigate(`/verify-device?userId=${encodeURIComponent(data.userId)}`);
        } else if (data.user) {
          dispatch(loginSuccess(data.user));
          toast.success(`${t('common.welcome')}, ${data.user.fullName || data.user.username}!`);
          navigate(homePath(data.user.role));
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

  return { formData, setField, showPassword, toggleShowPassword: () => setShowPassword((shown) => !shown), loading, handleSubmit };
};
