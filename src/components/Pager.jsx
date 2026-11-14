import { useTranslation } from 'react-i18next';

// "Page 2 of 7" with the buttons Back and Next. total is the number of rows, size the rows on a page.
const Pager = ({ page, total, size, onPage }) => {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
      <span>{t('audit.page', { page, pages })}</span>
      <span className="flex gap-2">
        <button className="btn-quiet" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t('audit.prev')}</button>
        <button className="btn-quiet" disabled={page >= pages} onClick={() => onPage(page + 1)}>{t('audit.next')}</button>
      </span>
    </div>
  );
};

export default Pager;
