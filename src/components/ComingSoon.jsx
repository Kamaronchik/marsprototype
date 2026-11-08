import { useTranslation } from 'react-i18next';
import PageHeader from './PageHeader';

// Honest placeholder for sections that are not built yet. title is a translation key.
const ComingSoon = ({ title }) => {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t(title)} />
      <div className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-14 text-center">
        <p className="font-display text-xl font-semibold text-ink">{t('comingSoon.title')}</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">{t('comingSoon.text')}</p>
      </div>
    </>
  );
};

export default ComingSoon;
