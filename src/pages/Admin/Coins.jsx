import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Coins as CoinsIcon, CalendarCheck, Check } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import CoinAmount from '../../components/CoinAmount';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { SkeletonRow } from '../../components/Skeleton';
import { formatDate } from '../../lib/format';

const EMPTY_AWARD = { studentId: '', amount: '', description: '' };

// Admin: coins for teachers (their pool) and coins directly to a student. The admin has no limit.
const Coins = () => {
  const { t, i18n } = useTranslation();
  const teachers = useFetch('/api/wallet/teachers');
  const students = useFetch('/api/students');
  const topup = useFetch('/api/wallet/pool-topup');

  const [giveTo, setGiveTo] = useState(null); // the teacher who gets coins
  const [giveAmount, setGiveAmount] = useState('');
  const [award, setAward] = useState(EMPTY_AWARD);
  const [confirmingTopup, setConfirmingTopup] = useState(false);
  const [runningTopup, setRunningTopup] = useState(false);

  const runTopup = async () => {
    setRunningTopup(true);
    try {
      const result = await api('/api/wallet/pool-topup', { method: 'POST' });
      toast.success(t('coinsAdmin.topupDone', { teachers: result.teacherCount, coins: result.totalCoins }));
      setConfirmingTopup(false);
      topup.reload();
      teachers.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setRunningTopup(false);
    }
  };

  const giveCoins = async (event) => {
    event.preventDefault();
    try {
      await api('/api/wallet/grant', { method: 'POST', body: { teacherId: giveTo.id, amount: Number(giveAmount) } });
      toast.success(t('coinsAdmin.added'));
      setGiveTo(null);
      setGiveAmount('');
      teachers.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const awardCoins = async (event) => {
    event.preventDefault();
    try {
      await api('/api/wallet/award', { method: 'POST', body: { studentId: award.studentId, amount: Number(award.amount), description: award.description } });
      toast.success(t('coinsAdmin.awarded'));
      setAward(EMPTY_AWARD);
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const list = teachers.data?.teachers ?? [];

  return (
    <>
      <PageHeader title={t('coinsAdmin.title')}>{t('coinsAdmin.subtitle')}</PageHeader>

      {topup.data && (
        <section className="mb-8 rounded-xl border border-line bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mars-tint text-mars"><CalendarCheck size={18} /></span>
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">{t('coinsAdmin.topupTitle')}</h2>
                <p className="text-sm text-ink-soft">{t('coinsAdmin.topupHint', { coins: topup.data.coinsPerStudent })}</p>
              </div>
            </div>
            {topup.data.alreadyDone ? (
              <span className="flex items-center gap-1.5 rounded-md bg-moss-tint px-3 py-1.5 text-sm font-semibold text-moss">
                <Check size={15} /> {t('coinsAdmin.topupDoneAlready', { date: formatDate(topup.data.doneAt, i18n.language) })}
              </span>
            ) : (
              <button onClick={() => setConfirmingTopup(true)} disabled={!topup.data.teachers.length} className="btn-primary">
                {t('coinsAdmin.topupButton', { count: topup.data.totalCoins })}
              </button>
            )}
          </div>

          {!topup.data.alreadyDone && topup.data.teachers.length > 0 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {topup.data.teachers.map((row) => (
                <li key={row.teacherId} className="flex items-center justify-between rounded-lg bg-sunken px-3 py-2 text-sm">
                  <span className="truncate text-ink">{row.teacherName} <span className="text-ink-faint">· {t('groups.studentsCount', { count: row.students })}</span></span>
                  <CoinAmount amount={row.coins} className="shrink-0 text-ink" />
                </li>
              ))}
            </ul>
          )}
          {!topup.data.alreadyDone && topup.data.teachers.length === 0 && (
            <p className="mt-3 text-sm text-ink-soft">{t('coinsAdmin.topupNoOne')}</p>
          )}
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">{t('coinsAdmin.teachers')}</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-card">
            <ul className="divide-y divide-line">
              {teachers.loading && Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} />)}
              {!teachers.loading && list.map((teacher) => (
                <li key={teacher.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{teacher.fullName}</div>
                    <div className="truncate text-xs text-ink-faint">{teacher.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-ink-faint">{t('coinsAdmin.pool')}</div>
                    <CoinAmount amount={teacher.balance} className="text-ink" />
                  </div>
                  <button onClick={() => setGiveTo(teacher)} className="btn-quiet !px-3 !py-1.5 text-xs">{t('coinsAdmin.give')}</button>
                </li>
              ))}
              {list.length === 0 && !teachers.loading && (
                <li className="px-5 py-10 text-center text-sm text-ink-soft">{t('coinsAdmin.noTeachers')}</li>
              )}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">{t('coinsAdmin.awardTitle')}</h2>
          <form onSubmit={awardCoins} className="space-y-4 rounded-xl border border-line bg-card p-5">
            <div>
              <label htmlFor="award-student" className="field-label">{t('coinsAdmin.student')}</label>
              <select id="award-student" value={award.studentId} onChange={(e) => setAward({ ...award, studentId: e.target.value })} className="field">
                <option value="">{t('coinsAdmin.chooseStudent')}</option>
                {(students.data?.students ?? []).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="award-amount" className="field-label">{t('coinsAdmin.amount')}</label>
              <input id="award-amount" type="number" min="1" step="1" value={award.amount} onChange={(e) => setAward({ ...award, amount: e.target.value })} className="field" />
            </div>
            <div>
              <label htmlFor="award-reason" className="field-label">{t('coinsAdmin.reason')}</label>
              <input id="award-reason" value={award.description} maxLength={200} onChange={(e) => setAward({ ...award, description: e.target.value })} className="field" />
            </div>
            <button type="submit" disabled={!award.studentId || !award.amount} className="btn-primary w-full">
              <CoinsIcon size={16} /> {t('coinsAdmin.awardButton')}
            </button>
          </form>
        </section>
      </div>

      {confirmingTopup && topup.data && (
        <Modal title={t('coinsAdmin.topupConfirmTitle')} onClose={() => setConfirmingTopup(false)}>
          <p className="text-sm leading-relaxed text-ink-soft">
            {t('coinsAdmin.topupConfirmText', { teachers: topup.data.teachers.length, coins: topup.data.totalCoins })}
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmingTopup(false)} className="btn-quiet">{t('common.cancel')}</button>
            <button type="button" onClick={runTopup} disabled={runningTopup} className="btn-primary">{t('coinsAdmin.topupConfirmButton')}</button>
          </div>
        </Modal>
      )}

      {giveTo && (
        <Modal title={t('coinsAdmin.giveTitle', { name: giveTo.fullName })} onClose={() => setGiveTo(null)}>
          <form onSubmit={giveCoins} className="space-y-4">
            <div>
              <label htmlFor="give-amount" className="field-label">{t('coinsAdmin.amount')}</label>
              <input id="give-amount" type="number" min="1" step="1" value={giveAmount} onChange={(e) => setGiveAmount(e.target.value)} className="field" autoFocus />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setGiveTo(null)} className="btn-quiet">{t('common.cancel')}</button>
              <button type="submit" disabled={!giveAmount} className="btn-primary">{t('coinsAdmin.give')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default Coins;
