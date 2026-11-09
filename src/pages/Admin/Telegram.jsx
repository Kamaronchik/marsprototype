import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, MessageCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { useFetch } from '../../lib/useFetch';
import { formatDate, formatDateTime } from '../../lib/format';

const KIND_STYLE = {
  absence_question: 'border-ochre/40 bg-ochre-tint',
  absence_reason: 'border-moss/40 bg-moss-tint',
};

// Admin: the "Telegram" tab. Answers to "why were you absent?" on top, and every conversation
// between a student and the assistant below.
const Telegram = () => {
  const { t, i18n } = useTranslation();
  const overview = useFetch('/api/admin/telegram');
  const [picked, setPicked] = useState(null);

  const chats = overview.data?.chats ?? [];
  const absences = overview.data?.absences ?? [];
  const selected = picked ?? chats[0]?.userId ?? null;
  const chat = useFetch(selected ? `/api/admin/telegram/chats/${selected}` : null);
  const messages = chat.data?.messages ?? [];
  const selectedName = chats.find((c) => c.userId === selected)?.name;

  return (
    <>
      <PageHeader title={t('telegramAdmin.title')}>{t('telegramAdmin.subtitle')}</PageHeader>

      <h2 className="mb-3 font-display text-xl font-semibold text-ink">{t('telegramAdmin.absences')}</h2>
      <div className="mb-8 overflow-hidden rounded-xl border border-line bg-card">
        {absences.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-ink-soft">{t('telegramAdmin.noAbsences')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {absences.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-x-6 gap-y-1 px-5 py-3.5">
                <div className="w-56 shrink-0">
                  <p className="text-sm font-semibold text-ink">{a.studentName}</p>
                  <p className="text-xs text-ink-faint">{a.groupName} · {formatDate(a.date, i18n.language, { day: 'numeric', month: 'short' })}</p>
                </div>
                {a.status === 'answered'
                  ? <p className="min-w-0 flex-1 text-sm text-ink">{a.reason}</p>
                  : <p className="min-w-0 flex-1 text-sm italic text-ochre">{t('telegramAdmin.waiting')}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="mb-3 font-display text-xl font-semibold text-ink">{t('telegramAdmin.conversations')}</h2>
      {chats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-12 text-center">
          <p className="font-display text-lg font-semibold text-ink">{t('telegramAdmin.noChats')}</p>
          <p className="mt-1 text-sm text-ink-soft">{t('telegramAdmin.noChatsHint')}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto rounded-xl border border-line bg-card">
            {chats.map((c) => (
              <li key={c.userId}>
                <button
                  type="button"
                  onClick={() => setPicked(c.userId)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left ${c.userId === selected ? 'bg-mars-tint/60' : 'hover:bg-sunken/60'}`}
                >
                  <MessageCircle size={16} className="shrink-0 text-mars" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                    <span className="block truncate text-xs text-ink-faint">{c.language.toUpperCase()} · {c.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex max-h-[32rem] flex-col rounded-xl border border-line bg-card">
            <p className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">{selectedName}</p>
            <ul className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.length === 0 && !chat.loading && <li className="py-8 text-center text-sm text-ink-soft">{t('telegramAdmin.noMessages')}</li>}
              {messages.map((m) => (
                <li key={m.id} className={`flex ${m.direction === 'in' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl border px-3.5 py-2 text-sm ${KIND_STYLE[m.kind] ?? 'border-line bg-sunken/60'}`}>
                    <p className="whitespace-pre-wrap text-ink">{m.body}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-faint">
                      {m.direction === 'out' && <Bot size={12} />}
                      {t(`telegramAdmin.kind_${m.kind}`)} · {formatDateTime(m.createdAt, i18n.language)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

export default Telegram;
