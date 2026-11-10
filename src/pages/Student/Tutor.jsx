import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, Loader2, Paperclip, Send, X } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';

const SUGGESTIONS = ['explain', 'error', 'review'];

// The answer of the model: text with code in ``` fences. Only the fences are turned into code blocks;
// everything else stays plain text (React escapes it, so nothing from the model can run as HTML).
const MessageText = ({ text }) => text.split(/```/).map((part, index) => {
  if (index % 2 === 0) {
    return part.trim() ? <p key={index} className="whitespace-pre-line">{part.trim()}</p> : null;
  }
  const code = part.replace(/^[\w+-]*\n/, '').trimEnd(); // the language name after the opening fence
  return (
    <pre key={index} className="my-2 overflow-x-auto rounded-lg bg-sunken px-3 py-2.5 font-mono text-[13px] leading-relaxed text-ink">
      <code>{code}</code>
    </pre>
  );
});

// Student: the AI tutor. The conversation lives in this page only; the server keeps nothing.
const Tutor = () => {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const homeworkId = params.get('homework');
  const homework = useFetch(homeworkId ? '/api/homework/mine' : null);
  const task = homework.data?.homework.find((h) => h.id === homeworkId);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const send = async (question) => {
    const value = question.trim();
    if (!value || busy) return;
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: 'user', text: value }]);
    setText('');
    setBusy(true);
    try {
      const reply = await api('/api/tutor/ask', {
        method: 'POST',
        body: { message: value, history, language: i18n.language.slice(0, 2), homeworkId: task ? homeworkId : undefined },
      });
      setMessages((prev) => [...prev, { role: 'model', text: reply.answer }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'model', text: errorText(t, error), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(text);
    }
  };

  const detach = () => {
    params.delete('homework');
    setParams(params, { replace: true });
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader title={t('tutor.title')}>{t('tutor.subtitle')}</PageHeader>

      {task && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-mars-tint/50 px-4 py-2.5 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-ink">
            <Paperclip size={15} className="shrink-0 text-mars" />
            <span className="truncate">{t('tutor.aboutHomework', { title: task.title })}</span>
          </span>
          <button onClick={detach} aria-label={t('common.close')} className="rounded p-1 text-ink-faint hover:bg-sunken hover:text-ink">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="min-h-[18rem] space-y-4 rounded-xl border border-line bg-card p-4 md:p-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mars-tint text-mars"><Bot size={24} /></span>
            <p className="font-display text-xl font-semibold text-ink">{t('tutor.hello')}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{t('tutor.hint')}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((key) => (
                <button key={key} className="btn-quiet !py-2" onClick={() => send(t(`tutor.suggestion.${key}`))}>
                  {t(`tutor.suggestion.${key}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, index) => (
          <div key={index} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] space-y-2 rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-mars text-on-accent'
                  : m.error ? 'bg-brick-tint text-brick' : 'bg-sunken text-ink'
              }`}
            >
              {m.role === 'user' ? <p className="whitespace-pre-line">{m.text}</p> : <MessageText text={m.text} />}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-ink-faint">
            <Loader2 size={15} className="animate-spin" /> {t('tutor.thinking')}
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="mt-4 flex items-end gap-2">
        <textarea
          className="field max-h-40 min-h-[3rem] resize-none"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('tutor.placeholder')}
          maxLength={2000}
          aria-label={t('tutor.placeholder')}
        />
        <button className="btn-primary h-12 shrink-0" disabled={busy || !text.trim()} aria-label={t('tutor.send')}>
          <Send size={17} />
        </button>
      </form>
    </div>
  );
};

export default Tutor;
