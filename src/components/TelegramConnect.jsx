import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Send, Link2Off } from 'lucide-react';
import { api, errorText } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { usePolling } from '../lib/usePolling';
import { formatDate } from '../lib/format';
import { SkeletonText } from './Skeleton';

const POLL_MS = 4 * 1000;
const LANGUAGE_NAMES = { ru: 'Русский', uz: "O'zbekcha", en: 'English' };

// Student: connect the Telegram assistant. The site makes a one-time link, the student presses Start
// in Telegram, and this card notices by itself (it asks the server every few seconds while waiting).
const TelegramConnect = () => {
  const { t, i18n } = useTranslation();
  const status = useFetch('/api/telegram/status');
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState(null);
  const { reload } = status;
  const linked = status.data?.linked;

  usePolling(reload, POLL_MS, !!waiting);

  // Once the chat is connected the waiting is over; the card itself changes, so no state is needed.
  const isWaiting = waiting && !linked;

  // The tab is opened at once, while the click still counts: a window opened after the server
  // has answered is blocked by the browser as a pop-up. The address is put into it afterwards.
  const connect = async () => {
    const tab = window.open('', '_blank');
    setBusy(true);
    try {
      const { url } = await api('/api/telegram/link', { method: 'POST' });
      const token = new URL(url).searchParams.get('start');
      const bot = new URL(url).pathname.slice(1);
      const web = `https://web.telegram.org/k/?tgaddr=${encodeURIComponent(`tg://resolve?domain=${bot}&start=${token}`)}`;
      setLinks({ app: url, web });
      if (tab) tab.location.href = url;
      setWaiting(true);
    } catch (error) {
      tab?.close();
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

          {status.loading && <SkeletonText width="10rem" height="2.3rem" className="mt-4" />}

          {(status.error || (status.data && !linked)) && (
            <div className="mt-4">
              {status.error && <p className="mb-3 text-sm text-brick">{errorText(t, status.error)}</p>}
              <button type="button" onClick={connect} disabled={busy} className="btn-primary">
                <Send size={16} /> {t('telegram.connect')}
              </button>
              {isWaiting && <p className="mt-3 text-sm text-ink-soft">{t('telegram.waiting')}</p>}
              {isWaiting && links && (
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <a href={links.app} target="_blank" rel="noreferrer" className="font-semibold text-mars hover:text-mars-deep">{t('telegram.openApp')}</a>
                  <a href={links.web} target="_blank" rel="noreferrer" className="font-semibold text-mars hover:text-mars-deep">{t('telegram.openWeb')}</a>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default TelegramConnect;
