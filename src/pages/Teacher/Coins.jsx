import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Coins as CoinsIcon } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import CoinAmount from '../../components/CoinAmount';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { SkeletonText } from '../../components/Skeleton';

const EMPTY_FORM = { studentId: '', amount: '', description: '' };

// Teacher: give coins to the students of own groups, out of the teacher's own pool.
const Coins = () => {
  const { t } = useTranslation();
  const pool = useFetch('/api/wallet/pool');
  const groups = useFetch('/api/groups/mine');
  const [form, setForm] = useState(EMPTY_FORM);

  // Recomputed only when the groups list actually changes, not on every keystroke in the form.
  const students = useMemo(
    () => [...new Map((groups.data?.groups ?? []).flatMap((g) => g.students.map((s) => [s.id, s]))).values()]
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [groups.data],
  );

  const give = async (event) => {
    event.preventDefault();
    try {
      const result = await api('/api/wallet/award', {
        method: 'POST',
        body: { studentId: form.studentId, amount: Number(form.amount), description: form.description },
      });
      toast.success(t('teacherCoins.given', { remaining: result.remaining }));
      setForm(EMPTY_FORM);
      pool.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <>
      <PageHeader title={t('teacherCoins.title')}>{t('teacherCoins.subtitle')}</PageHeader>

      <div className="mb-8 rounded-xl border border-line bg-card px-6 py-5">
        <p className="text-sm text-ink-soft">{t('teacherCoins.pool')}</p>
        <p className="mt-1 text-4xl">
          {pool.data && <CoinAmount amount={pool.data.balance} className="font-display text-ink" />}
          {!pool.data && pool.loading && <SkeletonText width="5rem" height="2rem" />}
          {!pool.data && !pool.loading && '—'}
        </p>
        <p className="mt-2 text-xs text-ink-faint">{t('teacherCoins.poolHint')}</p>
      </div>

      {students.length === 0 && !groups.loading ? (
        <p className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-10 text-center text-sm text-ink-soft">
          {t('teacherCoins.noStudents')}
        </p>
      ) : (
        <form onSubmit={give} className="max-w-xl space-y-4 rounded-xl border border-line bg-card p-5">
          <div>
            <label htmlFor="give-student" className="field-label">{t('teacherCoins.student')}</label>
            <select id="give-student" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className="field">
              <option value="">{t('teacherCoins.chooseStudent')}</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <div>
              <label htmlFor="give-amount" className="field-label">{t('teacherCoins.amount')}</label>
              <input id="give-amount" type="number" min="1" max="50" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="field" />
            </div>
            <div>
              <label htmlFor="give-reason" className="field-label">{t('teacherCoins.reason')}</label>
              <input id="give-reason" value={form.description} maxLength={200} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field" />
            </div>
          </div>
          <button type="submit" disabled={!form.studentId || !form.amount} className="btn-primary">
            <CoinsIcon size={16} /> {t('teacherCoins.give')}
          </button>
        </form>
      )}
    </>
  );
};

export default Coins;
