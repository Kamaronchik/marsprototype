import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { SkeletonRow } from './Skeleton';

const MIN_CHARS = 2;
const DELAY_MS = 250;
const MAX_RESULTS = 6;

// The admin's command bar: type a name, a group, a teacher or a room and see the students at once
// (group, room, time, payment status). Enter or a click opens the full list. Ctrl+K focuses it.
const CommandSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const box = useRef(null);
  const input = useRef(null);
  const [text, setText] = useState('');
  const [results, setResults] = useState(null); // null = nothing asked yet
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  const query = text.trim();

  // Ask the server a moment after the typing stops.
  useEffect(() => {
    if (query.length < MIN_CHARS) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setPending(true);
      api(`/api/students?q=${encodeURIComponent(query)}`)
        .then((data) => { if (!cancelled) setResults(data.students.slice(0, MAX_RESULTS)); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setPending(false); });
    }, DELAY_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  // Ctrl+K from anywhere; a click outside closes the list.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
      }
    };
    const onClick = (event) => { if (box.current && !box.current.contains(event.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const openList = (value) => {
    setOpen(false);
    navigate(`/admin/students?q=${encodeURIComponent(value)}`);
  };

  const shown = query.length >= MIN_CHARS ? results : null;

  return (
    <div ref={box} className="relative w-full">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" size={16} />
      <input
        ref={input}
        type="search"
        value={text}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query) openList(query);
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={t('command.placeholder')}
        aria-label={t('command.placeholder')}
        className="field h-10 pl-10 pr-16 text-sm"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:block">Ctrl K</kbd>

      {open && shown && (
        <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-line bg-card shadow-xl">
          <ul className="divide-y divide-line">
            {pending && results === null && Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} avatar trailing={false} />)}
            {(!pending || results !== null) && shown.map((student) => (
              <li key={student.id}>
                <button onClick={() => openList(student.fullName)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-sunken/60">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunken font-display text-sm font-semibold text-ink-soft">{student.fullName.charAt(0)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{student.fullName}</span>
                    <span className="block truncate text-xs text-ink-faint">
                      {student.groups.length ? student.groups.map((g) => `${g.name} · ${g.room}`).join(', ') : t('students.noGroup')}
                    </span>
                  </span>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${student.paymentStatus === 'debtor' ? 'bg-brick-tint text-brick' : 'bg-moss-tint text-moss'}`}>
                    {t(`students.${student.paymentStatus}`)}
                  </span>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-soft">{t('students.empty')}</li>}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CommandSearch;
