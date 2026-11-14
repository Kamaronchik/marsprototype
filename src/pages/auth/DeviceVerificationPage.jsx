import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../../features/auth/authSlice';
import { toast } from 'react-toastify';
import { ArrowLeft, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Logo from '../../components/Logo';
import LanguageSwitch from '../../components/LanguageSwitch';
import ThemeToggle from '../../components/ThemeToggle';
import { messageText } from '../../lib/api';
import { homePath } from '../../lib/roleHome';

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
  const [failed, setFailed] = useState(0); // grows on every wrong code: restarts the shake animation
  const lastSent = useRef(''); // the code that was sent last, so one code is never sent twice

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

  const focusBox = (index) => document.getElementById(`code-${index}`)?.focus();

  const handleInputChange = (index, value) => {
    const digits = value.replace(/\D/g, '');
    if (value && !digits) return;

    // Several digits at once (autofill from the keyboard): fill the boxes from here.
    if (digits.length > 1) {
      const next = [...code];
      digits.slice(0, 6 - index).split('').forEach((d, i) => { next[index + i] = d; });
      setCode(next);
      focusBox(Math.min(index + digits.length, 5));
      return;
    }

    const next = [...code];
    next[index] = digits;
    setCode(next);
    if (index < 5 && digits) focusBox(index + 1);
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) focusBox(index - 1);
    if (e.key === 'ArrowLeft' && index > 0) focusBox(index - 1);
    if (e.key === 'ArrowRight' && index < 5) focusBox(index + 1);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setCode(digits);
      focusBox(5);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const submit = async (fullCode) => {
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
        navigate(homePath(data.user.role));
      } else {
        toast.error(data.message ? messageText(t, data.message) : t('verify.failed'));
        wrongCode();
      }
    } catch {
      toast.error(t('verify.connection'));
      wrongCode();
    } finally {
      setLoading(false);
    }
  };

  // A wrong code: shake the boxes, empty them and let the person type again.
  const wrongCode = () => {
    setFailed((n) => n + 1);
    lastSent.current = '';
    setCode(['', '', '', '', '', '']);
    focusBox(0);
  };

  // The code is sent by itself as soon as the sixth digit is in.
  const fullCode = code.join('');
  useEffect(() => {
    if (fullCode.length === 6 && !loading && lastSent.current !== fullCode) {
      lastSent.current = fullCode;
      submit(fullCode);
    }
    // submit only uses the code it is given, the other values do not change when it is sent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullCode, loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (fullCode.length !== 6) toast.error(t('verify.enterAll'));
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
        lastSent.current = '';
        focusBox(0);
      } else {
        toast.error(data.message ? messageText(t, data.message) : t('verify.resendFailed'));
      }
    } catch {
      toast.error(t('verify.resendConnection'));
    } finally {
      setResending(false);
    }
  };

  const progress = (fullCode.length / 6) * 100;

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-10">
      <div className="flex w-full max-w-5xl items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4"><ThemeToggle /><LanguageSwitch /></div>
      </div>

      <div className="otp-rise my-auto w-full max-w-md py-10">
        <button
          onClick={() => navigate('/login')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <ArrowLeft size={16} /> {t('verify.back')}
        </button>

        <div className="rounded-2xl border border-line bg-card p-7 shadow-xl sm:p-9">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-mars-tint text-mars">
            <ShieldCheck size={24} strokeWidth={1.8} />
          </span>
          <h1 className="mt-5 font-display text-[1.9rem] font-semibold leading-tight tracking-tight text-ink">{t('verify.title')}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{t('verify.text')}</p>

          <form onSubmit={handleSubmit} className="mt-7">
            {/* key={failed}: a new element after a wrong code, so the shake plays again */}
            <div key={failed} className={`flex gap-2 sm:gap-3 ${failed ? 'otp-shake' : ''}`} onPaste={handlePaste}>
              {code.map((digit, idx) => (
                <input
                  key={idx}
                  id={`code-${idx}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus={idx === 0}
                  disabled={loading}
                  aria-label={t('verify.digit', { n: idx + 1 })}
                  className={`field h-14 w-full min-w-0 px-0 text-center font-display text-2xl font-semibold disabled:opacity-60 ${digit ? 'otp-pop border-mars' : ''}`}
                  value={digit}
                  onChange={(e) => handleInputChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                />
              ))}
            </div>

            <div className="mt-4 h-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
              <div className="h-full rounded-full bg-mars" style={{ width: `${loading ? 100 : progress}%` }} />
            </div>

            <p className="mt-3 flex h-5 items-center gap-2 text-sm text-ink-soft" aria-live="polite">
              {loading && (
                <>
                  <Loader2 className="animate-spin" size={15} />
                  <span>{t('verify.checking')}</span>
                </>
              )}
            </p>
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-ink-soft">
          <p>{t('verify.noMail')}</p>
          <button
            type="button"
            disabled={timer > 0 || resending}
            className="mt-1.5 inline-flex items-center gap-1.5 font-semibold text-mars hover:text-mars-deep disabled:pointer-events-none disabled:text-ink-faint"
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
