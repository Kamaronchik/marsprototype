import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import Pager from '../../components/Pager';
import { SkeletonText } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import PenaltyForm from './PenaltyForm';
import PenaltyCard from './PenaltyCard';

const PAGE_SIZE = 20;
const TABS = ['active', 'resolved', 'dismissed', ''];

// Penalties by the rules of Mars. The auditor gives them and can take them back;
// every penalty goes to the CEO, who confirms or cancels it with a reason.
const Penalties = () => {
  const { t } = useTranslation();
  const isCeo = useSelector((state) => state.auth.user?.role) === 'Owner';
  const [tab, setTab] = useState('active');
  const [page, setPage] = useState(1);
  const list = useFetch(`/api/owner/violations?source=audit&page=${page}&pageSize=${PAGE_SIZE}${tab ? `&status=${tab}` : ''}`);
  const rows = list.data?.violations ?? [];

  const pick = (value) => { setTab(value); setPage(1); };

  return (
    <>
      <PageHeader title={t('penalty.title')}>{t(isCeo ? 'penalty.hintCeo' : 'penalty.hintAuditor')}</PageHeader>

      <PenaltyForm onIssued={() => { pick('active'); list.reload(); }} />

      <div className="mb-5 mt-8 flex flex-wrap gap-2">
        {TABS.map((value) => (
          <button key={value || 'all'} onClick={() => pick(value)} className={tab === value ? 'btn-primary' : 'btn-quiet'}>
            {t(`penalty.tab.${value || 'all'}`)}
          </button>
        ))}
      </div>

      {list.loading && <SkeletonText height="8rem" />}
      {!list.loading && rows.length === 0 && (
        <p className="rounded-xl border border-line bg-card py-14 text-center text-sm text-ink-soft">{t('penalty.empty')}</p>
      )}

      <ul className="space-y-3">
        {rows.map((p) => <PenaltyCard key={p.id + p.status} penalty={p} isCeo={isCeo} onChanged={list.reload} />)}
      </ul>

      <Pager page={page} total={list.data?.total ?? 0} size={PAGE_SIZE} onPage={setPage} />
    </>
  );
};

export default Penalties;
