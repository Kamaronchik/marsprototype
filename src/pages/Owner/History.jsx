import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { SkeletonText } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { formatDateTime } from '../../lib/format';
import { useAuditSentence } from '../../lib/useAuditSentence';

// Every change of one thing (a mark, a group, a person), from the first to the last.
const History = () => {
  const { t, i18n } = useTranslation();
  const { entity, id } = useParams();
  const sentence = useAuditSentence();
  const history = useFetch(`/api/owner/history/${entity}/${id}`);
  const entries = history.data?.entries ?? [];

  return (
    <>
      <PageHeader title={t('owner.historyTitle')}>{t('owner.historyHint')}</PageHeader>
      <Link to="/owner/journal" className="mb-4 inline-block text-sm text-mars">{t('owner.backToJournal')}</Link>

      {history.loading && <SkeletonText height="6rem" />}
      {!history.loading && entries.length === 0 && <p className="py-10 text-center text-sm text-ink-soft">{t('audit.empty')}</p>}

      <ol className="space-y-3">
        {entries.map((e) => (
          <li key={e.id} className="rounded-xl border border-line bg-card px-5 py-4">
            <p className="text-sm font-semibold text-ink">{sentence(e)}</p>
            <p className="mt-0.5 text-xs text-ink-faint">
              {formatDateTime(e.at, i18n.language)} · {e.actor?.name ?? t('owner.system')} · {e.ip ?? '—'}
            </p>
            {(e.oldValue || e.newValue) && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <pre className="max-h-40 overflow-auto rounded-lg bg-sunken p-3 text-xs text-ink">{JSON.stringify(e.oldValue, null, 2)}</pre>
                <pre className="max-h-40 overflow-auto rounded-lg bg-sunken p-3 text-xs text-ink">{JSON.stringify(e.newValue, null, 2)}</pre>
              </div>
            )}
          </li>
        ))}
      </ol>
    </>
  );
};

export default History;
