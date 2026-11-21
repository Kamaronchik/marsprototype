import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useFetch } from '../../lib/useFetch';
import { api, errorText } from '../../lib/api';

const LEVELS = ['reminder', 'green', 'yellow', 'red', 'black'];

// The form of a new penalty: which teacher, which rule of Mars, what happened, and a fine if needed.
const PenaltyForm = ({ onIssued }) => {
  const { t } = useTranslation();
  const staff = useFetch('/api/owner/staff');
  const rules = useFetch('/api/owner/mars-rules');
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [ruleCode, setRuleCode] = useState('');
  const [comment, setComment] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  // Every working teacher, found by a part of the name.
  const teachers = (staff.data?.staff ?? []).filter((p) => p.role === 'Teacher' && p.status === 'active');
  const shown = teachers.filter((p) => p.fullName.toLowerCase().includes(search.trim().toLowerCase()));
  const allRules = rules.data?.rules ?? [];
  const chosenRule = allRules.find((r) => r.code === ruleCode);

  const ready = userId && ruleCode && comment.trim().length >= 3;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/owner/penalties', {
        method: 'POST',
        body: { userId, ruleCode, comment: comment.trim(), amount: amount === '' ? 0 : Number(amount) },
      });
      toast.success(t('penalty.issued'));
      setUserId('');
      setRuleCode('');
      setComment('');
      setAmount('');
      onIssued();
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold text-ink">{t('penalty.newTitle')}</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="p-search" className="field-label">{t('penalty.teacher', { total: teachers.length })}</label>
          <input id="p-search" className="field" value={search} placeholder={t('penalty.searchTeacher')} onChange={(e) => setSearch(e.target.value)} />
          {/* Buttons, not a <select size>: the browser highlights the first row of a list box
              even when nothing is chosen, and a click on it then changes nothing. */}
          <ul role="radiogroup" aria-label={t('penalty.teacher', { total: teachers.length })} className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-line">
            {shown.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={userId === p.id}
                  onClick={() => setUserId(p.id)}
                  className={`block w-full px-3 py-2 text-left text-sm ${userId === p.id ? 'bg-mars-tint font-semibold text-ink' : 'text-ink-soft hover:bg-sunken'}`}
                >
                  {p.fullName}
                </button>
              </li>
            ))}
          </ul>
          {!staff.loading && shown.length === 0 && <p className="mt-1 text-xs text-ink-faint">{t('penalty.noTeachers')}</p>}
        </div>

        <div>
          <label htmlFor="p-rule" className="field-label">{t('penalty.ruleLabel')}</label>
          <select id="p-rule" className="field pr-8" value={ruleCode} onChange={(e) => setRuleCode(e.target.value)}>
            <option value="">{t('penalty.chooseRule')}</option>
            {LEVELS.map((level) => (
              <optgroup key={level} label={t(`penalty.level.${level}`)}>
                {allRules.filter((r) => r.level === level).map((r) => (
                  <option key={r.code} value={r.code}>{r.number} · {t(`penalty.rule.${r.code}`)}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {chosenRule && <p className="mt-2 text-sm text-ink-soft">{t(`penalty.consequence.${chosenRule.level}`)}</p>}

          <label htmlFor="p-amount" className="field-label mt-4">{t('penalty.amount')}</label>
          <input id="p-amount" className="field" type="number" min="0" step="1000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="mt-1 text-xs text-ink-faint">{t('penalty.amountHint')}</p>
        </div>
      </div>

      <label htmlFor="p-comment" className="field-label mt-4">{t('penalty.whatHappened')}</label>
      <textarea id="p-comment" className="field" rows="3" maxLength="500" value={comment} onChange={(e) => setComment(e.target.value)} />

      <button type="submit" className="btn-primary mt-4" disabled={busy || !ready}>{t('penalty.issue')}</button>
    </form>
  );
};

export default PenaltyForm;
