import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';

const DeviceVerificationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
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
    if (isNaN(Number(value))) return;
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      toast.error('Please enter the full 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/verify-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code: fullCode }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Device verified successfully!');
        navigate(`/${data.user?.role?.toLowerCase() || 'student'}`);
      } else {
        toast.error(data.message || 'Verification failed');
      }
    } catch {
      toast.error('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-space-dark p-4">
      <div className="w-full max-w-md bg-space-deep border border-space-muted/10 rounded-3xl p-8 shadow-2xl text-center">
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

        <h1 className="text-3xl font-bold text-space-text mb-2">Verify Device</h1>
        <p className="text-space-muted mb-8">
          We've sent a verification code to your registered email address.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex justify-center gap-3">
            {code.map((digit, idx) => (
              <input
                key={idx}
                id={`code-${idx}`}
                type="text"
                maxLength="1"
                className="w-12 h-14 text-center text-2xl font-bold bg-space-dark border border-space-muted/20 rounded-xl text-space-text focus:outline-none focus:ring-2 focus:ring-space-accent/50 transition-all"
                value={digit}
                onChange={(e) => handleInputChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-space-accent hover:bg-space-accent/90 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-space-accent/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify Device'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-space-muted/10">
          <p className="text-space-muted text-sm mb-4">
            Didn't receive a code?
          </p>
          <button
            disabled={timer > 0}
            className="text-space-accent hover:text-space-accent/80 font-medium disabled:text-space-muted/50 transition-colors"
            onClick={() => { /* Trigger resend API */ }}
          >
            {timer > 0 ? `Resend code in ${formatTime(timer)}` : 'Resend Code Now'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceVerificationPage;
