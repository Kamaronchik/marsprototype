import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../../features/auth/authSlice';
import { toast } from 'react-toastify';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Logo from '../../components/Logo';
import LanguageSwitch from '../../components/LanguageSwitch';
import DesignSwitch from '../../components/DesignSwitch';
import { messageText } from '../../lib/api';

const DeviceVerificationPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60); // resend available every 1 minute

  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [navigate, userId]);

  const handleInputChange = (index, value) => {
    // Only accept numeric input
    if (value && isNaN(Number(value))) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (index < 5 && value) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setCode(digits);
      document.getElementById('code-5')?.focus();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      toast.error(t('verify.enterAll'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/verify-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, code: fullCode }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        toast.success(t('verify.verified'));
        dispatch(loginSuccess(data.user));
        const targetRole = data.user.role?.toLowerCase() || 'student';
        navigate(`/${targetRole}`);
      } else {
        toast.error(data.message ? messageText(t, data.message) : t('verify.failed'));
      }
    } catch {
      toast.error(t('verify.connection'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || resending || !userId) return;

    setResending(true);
    try {
      const response = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message ? messageText(t, data.message) : t('verify.resent'));
        setTimer(60);
        setCode(['', '', '', '', '', '']);
        document.getElementById('code-0')?.focus();
      } else {
        toast.error(data.message ? messageText(t, data.message) : t('verify.resendFailed'));
      }
    } catch {
      toast.error(t('verify.resendConnection'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-10">
      <div className="flex w-full max-w-5xl items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4"><DesignSwitch /><LanguageSwitch /></div>
      </div>

      <div className="my-auto w-full max-w-md py-10">
        <button
          onClick={() => navigate('/login')}
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <ArrowLeft size={16} /> {t('verify.back')}
        </button>

        <h1 className="font-display text-[2rem] font-semibold tracking-tight text-ink">{t('verify.title')}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {t('verify.text')}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="flex gap-2 sm:gap-3" onPaste={handlePaste}>
            {code.map((digit, idx) => (
              <input
                key={idx}
                id={`code-${idx}`}
                type="text"
                inputMode="numeric"
                maxLength="1"
                autoComplete="one-time-code"
                aria-label={t('verify.digit', { n: idx + 1 })}
                className="field h-14 w-full min-w-0 px-0 text-center font-display text-2xl font-semibold"
                value={digit}
                onChange={(e) => handleInputChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
              />
            ))}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={17} />
                <span>{t('verify.checking')}</span>
              </>
            ) : (
              <span>{t('verify.confirm')}</span>
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-line pt-6 text-sm text-ink-soft">
          <p>{t('verify.noMail')}</p>
          <button
            type="button"
            disabled={timer > 0 || resending}
            className="mt-2 inline-flex items-center gap-1.5 font-semibold text-mars hover:text-mars-deep disabled:pointer-events-none disabled:text-ink-faint"
            onClick={handleResend}
          >
            {resending ? (
              <>
                <RefreshCw className="animate-spin" size={14} />
                <span>{t('verify.sending')}</span>
              </>
            ) : timer > 0 ? (
              <span>{t('verify.resendIn', { time: formatTime(timer) })}</span>
            ) : (
              <span>{t('verify.resend')}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceVerificationPage;
