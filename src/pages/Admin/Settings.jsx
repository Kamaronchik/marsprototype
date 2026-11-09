import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PageHeader from '../../components/PageHeader';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { SkeletonText } from '../../components/Skeleton';
import i18n from '../../i18n/i18n';
import { LANGUAGES } from '../../i18n/overrides';
import ru from '../../i18n/locales/ru.json';
import uz from '../../i18n/locales/uz.json';
import en from '../../i18n/locales/en.json';

const MAX_ROWS = 60;

// {a: {b: 'text'}} -> {'a.b': 'text'}
const flatten = (object, prefix = '') => Object.fromEntries(
  Object.entries(object).flatMap(([key, value]) => (
    typeof value === 'object' ? Object.entries(flatten(value, `${prefix}${key}.`)) : [[`${prefix}${key}`, value]]
  )),
);

// The texts that come with the site, per language.
const BUNDLED = { ru: flatten(ru.translation), uz: flatten(uz.translation), en: flatten(en.translation) };

// Admin: change any word of the site in any language. The new text is saved on the server
// and shown to everyone at once.
const Settings = () => {
  const { t } = useTranslation();
  const [lang, setLang] = useState('ru');
  const [search, setSearch] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [drafts, setDrafts] = useState({}); // 'ru:groups.title' -> text typed but not saved yet

  const { data, loading, reload } = useFetch(`/api/i18n/${lang}`);
  // data stays the same object between renders until reloaded, so keying this on it (not on a
  // freshly-built `?? {}` object) lets the useMemo below actually skip work.
  const overrides = useMemo(() => data?.overrides ?? {}, [data]);
  const original = BUNDLED[lang];

  const needle = search.trim().toLowerCase();
  // ~250 keys filtered and sorted. Typing a draft into one row's textarea re-renders every row
  // (drafts is one shared object), so without useMemo this whole scan would redo on every keystroke
  // typed anywhere on the page, not just in the search box.
  const matching = useMemo(
    () => Object.keys(original)
      .filter((key) => !onlyChanged || key in overrides)
      .filter((key) => !needle || [key, original[key], overrides[key] ?? ''].some((text) => text.toLowerCase().includes(needle)))
      .sort(),
    [original, overrides, onlyChanged, needle],
  );
  const rows = matching.slice(0, MAX_ROWS);

  const draftKey = (key) => `${lang}:${key}`;
  const shown = (key) => drafts[draftKey(key)] ?? overrides[key] ?? original[key];
  const clearDraft = (key) => setDrafts(({ [draftKey(key)]: _gone, ...rest }) => rest);

  const save = async (key) => {
    try {
      await api('/api/i18n', { method: 'PUT', body: { lang, key, value: drafts[draftKey(key)] } });
      i18n.addResource(lang, 'translation', key, drafts[draftKey(key)].trim());
      toast.success(t('settings.saved'));
      clearDraft(key);
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const reset = async (key) => {
    try {
      await api('/api/i18n', { method: 'DELETE', body: { lang, key } });
      i18n.addResource(lang, 'translation', key, original[key]);
      toast.info(t('settings.resetDone'));
      clearDraft(key);
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <>
      <PageHeader title={t('settings.title')}>{t('settings.subtitle')}</PageHeader>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div role="group" aria-label={t('settings.language')} className="flex gap-1.5">
          {LANGUAGES.map((code) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold uppercase ${
                lang === code ? 'border-ink bg-ink text-card' : 'border-line bg-card text-ink-soft hover:text-ink'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('settings.search')}
          aria-label={t('settings.search')}
          className="field min-w-[240px] flex-1"
        />
        <label className="flex items-center gap-2 pb-2.5 text-sm text-ink">
          <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} className="h-4 w-4 accent-mars" />
          {t('settings.onlyChanged')}
        </label>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-ink-faint">
        {t('settings.hint', { example: '{{name}}' })} · {t('settings.changedCount', { count: Object.keys(overrides).length })}
      </p>

      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <ul className="divide-y divide-line">
          {loading && Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1.4fr_auto]">
              <div><SkeletonText width="10rem" height="0.7rem" className="mb-2" /><SkeletonText width="14rem" /></div>
              <SkeletonText width="100%" height="2.5rem" />
              <SkeletonText width="4rem" height="1.8rem" />
            </li>
          ))}
          {!loading && rows.map((key) => {
            const changed = key in overrides;
            const draft = drafts[draftKey(key)];
            return (
              <li key={key} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1.4fr_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-ink-faint">{key}</div>
                  <div className="mt-1 text-sm text-ink-soft">
                    <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{t('settings.original')}</span>
                    {original[key]}
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={shown(key)}
                  onChange={(e) => setDrafts({ ...drafts, [draftKey(key)]: e.target.value })}
                  aria-label={`${t('settings.yours')}: ${key}`}
                  className={`field resize-y ${changed ? 'border-mars/60' : ''}`}
                />
                <div className="flex gap-2 lg:flex-col">
                  <button onClick={() => save(key)} disabled={draft === undefined || !draft.trim() || draft === (overrides[key] ?? original[key])} className="btn-primary !px-3 !py-1.5 text-xs">
                    {t('settings.save')}
                  </button>
                  {changed && <button onClick={() => reset(key)} className="btn-quiet !px-3 !py-1.5 text-xs">{t('settings.reset')}</button>}
                </div>
              </li>
            );
          })}
          {!loading && rows.length === 0 && <li className="px-5 py-14 text-center text-sm text-ink-soft">{t('settings.noMatch')}</li>}
        </ul>
      </div>

      {matching.length > MAX_ROWS && (
        <p className="mt-3 text-center text-xs text-ink-faint">{t('settings.showing', { shown: MAX_ROWS, total: matching.length })}</p>
      )}
    </>
  );
};

export default Settings;
