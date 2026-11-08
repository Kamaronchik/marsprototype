import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/format';
import { formatMoney } from '../lib/money';

const REFRESH_MS = 60 * 1000;

// The bell of every role: unread counter and the latest notifications.
// The server sends a type and some data; the text is built here, in the user's language.
const NotificationBell = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const box = useRef(null);

  const load = useCallback(() => {
    api('/api/notifications')
      .then((data) => { setItems(data.notifications); setUnread(data.unreadCount); })
      .catch(() => {}); // the bell must never break the page
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (box.current && !box.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const text = (n) => t(`notif.${n.type.replace('.', '_')}`, {
    ...n.data,
    date: n.data.date ? formatDate(n.data.date, i18n.language) : '',
    amount: n.data.amount != null ? formatMoney(n.data.amount, i18n.language, t) : '',
    reason: n.data.reason ? ` (${n.data.reason})` : '',
    courseName: n.data.course ? t(`battle.courses.${n.data.course}`) : '',
    result: n.data.outcome ? t(`battle.${n.data.outcome}`) : '',
    defaultValue: t('notif.unknown'),
  });

  const toggle = () => {
    if (!open) load();
    setOpen(!open);
  };

  const openItem = (n) => {
    setOpen(false);
    if (!n.isRead) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnread((count) => Math.max(0, count - 1));
      api(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    await api('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
    load();
  };

  return (
    <div ref={box} className="relative">
      <button
        onClick={toggle}
        aria-label={t('bell.title')}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-ink-soft hover:bg-card hover:text-ink"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-mars px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-card shadow-xl md:left-0 md:right-auto">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-display text-base font-semibold text-ink">{t('bell.title')}</h2>
            {unread > 0 && (
              <button onClick={readAll} className="text-xs font-semibold text-mars hover:text-mars-deep">
                {t('bell.markAll')}
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => openItem(n)}
                  className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-sunken/60 ${n.isRead ? '' : 'bg-mars-tint/40'}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-mars'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm leading-snug text-ink">{text(n)}</span>
                    <span className="mt-0.5 block text-xs text-ink-faint">{formatDateTime(n.createdAt, i18n.language)}</span>
                  </span>
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-ink-soft">{t('bell.empty')}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
