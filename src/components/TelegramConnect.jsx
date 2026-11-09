import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Send, Link2Off } from 'lucide-react';
import { api, errorText } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { formatDate } from '../lib/format';

const POLL_MS = 4 * 1000;
const LANGUAGE_NAMES = { ru: 'Русский', uz: "O'zbekcha", en: 'English' };

// Student: connect the Telegram assistant. The site makes a one-time link, the student presses Start
// in Telegram, and this card notices by itself (it asks the server every few seconds while waiting).
const TelegramConnect = () => {
  const { t, i18n } = useTranslation();
  const status = useFetch('/api/telegram/status');
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const { reload } = status;
  const linked = status.data?.linked;

  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, reload]);

  // Once the chat is connected the waiting is over; the card itself changes, so no state is needed.
  const isWaiting = waiting && !linked;

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await api('/api/telegram/link', { method: 'POST' });
      window.open(url, '_blank', 'noopener');
      setWaiting(true);
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api('/api/telegram/link', { method: 'DELETE' });
      setWaiting(false);
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-card p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-tint text-sky"><Send size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold text-ink">{t('telegram.title')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{t('telegram.about')}</p>

          {status.data && linked && (
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <p className="text-sm text-ink">
                <span className="font-semibold text-moss">{t('telegram.connected')}</span>
                <span className="text-ink-soft"> · {LANGUAGE_NAMES[status.data.language]} · {formatDate(status.data.linkedAt, i18n.language, { day: 'numeric', month: 'short' })}</span>
              </p>
              <button type="button" onClick={disconnect} disabled={busy} className="btn-quiet text-sm">
                <Link2Off size={16} /> {t('telegram.disconnect')}
              </button>
            </div>
          )}

          {status.loading && <p className="mt-4 text-sm text-ink-faint">...</p>}

          {(status.error || (status.data && !linked)) && (
            <div className="mt-4">
              {status.error && <p className="mb-3 text-sm text-brick">{errorText(t, status.error)}</p>}
              <button type="button" onClick={connect} disabled={busy} className="btn-primary">
                <Send size={16} /> {t('telegram.connect')}
              </button>
              {isWaiting && <p className="mt-3 text-sm text-ink-soft">{t('telegram.waiting')}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default TelegramConnect;
