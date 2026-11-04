import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../../features/auth/authSlice';
import { toast } from 'react-toastify';
import { ShieldAlert, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';

const DeviceVerificationPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(300); // 5 minutes

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
      toast.error('Please enter the full 6-digit verification code');
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
        toast.success('Device verified successfully!');
        dispatch(loginSuccess(data.user));
        const targetRole = data.user.role?.toLowerCase() || 'student';
        navigate(`/${targetRole}`);
      } else {
        toast.error(data.message || 'Verification failed');
      }
    } catch {
      toast.error('Connection error. Please try again.');
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
        toast.success(data.message || 'New verification code sent to your email');
        setTimer(300);
        setCode(['', '', '', '', '', '']);
        document.getElementById('code-0')?.focus();
      } else {
        toast.error(data.message || 'Failed to resend code');
      }
    } catch {
      toast.error('Connection error while resending code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-space-dark p-4">
      <div className="w-full max-w-md bg-space-deep border border-space-muted/10 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden backdrop-blur-md">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-space-accent/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex justify-start mb-6">
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-space-muted hover:text-space-text transition-colors text-sm"
          >
            <ArrowLeft size={16} /> Back to Login
          </button>
        </div>

        <div className="inline-flex items-center justify-center w-20 h-20 bg-space-accent/10 text-space-accent rounded-full mb-6">
          <ShieldAlert size={40} />
        </div>

        <h1 className="text-3xl font-bold text-space-text mb-2 tracking-tight">Two-Factor Authentication</h1>
        <p className="text-space-muted mb-8 text-sm leading-relaxed">
          New device detected. We have sent a 6-digit confirmation code to your registered email address.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex justify-center gap-2.5 sm:gap-3" onPaste={handlePaste}>
            {code.map((digit, idx) => (
              <input
                key={idx}
                id={`code-${idx}`}
                type="text"
                inputMode="numeric"
                maxLength="1"
                autoComplete="one-time-code"
                className="w-12 h-14 text-center text-2xl font-bold bg-space-dark/80 border border-space-muted/20 rounded-xl text-space-text focus:outline-none focus:ring-2 focus:ring-space-accent/50 focus:border-space-accent/60 transition-all shadow-inner"
                value={digit}
                onChange={(e) => handleInputChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-space-accent hover:bg-space-accent/90 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-space-accent/25 hover:shadow-space-accent/40 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Verifying Device...</span>
              </>
            ) : (
              <span>Verify & Continue</span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-space-muted/10">
          <p className="text-space-muted text-xs mb-3">
            Didn't receive the email code? Check your Spam folder or resend.
          </p>
          <button
            type="button"
            disabled={timer > 0 || resending}
            className="inline-flex items-center gap-1.5 text-space-accent hover:text-space-accent/80 font-medium text-sm disabled:text-space-muted/50 disabled:pointer-events-none transition-colors"
            onClick={handleResend}
          >
            {resending ? (
              <>
                <RefreshCw className="animate-spin" size={14} />
                <span>Sending...</span>
              </>
            ) : timer > 0 ? (
              <span>Resend code in {formatTime(timer)}</span>
            ) : (
              <span>Resend Code Now</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceVerificationPage;
