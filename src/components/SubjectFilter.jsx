import { useTranslation } from 'react-i18next';
import { useFetch } from '../lib/useFetch';
import { subjectName } from '../lib/subject';

// A small "Subject: all / Frontend / ..." box for the analytics pages of the academic manager.
const SubjectFilter = ({ value, onChange }) => {
  const { t, i18n } = useTranslation();
  const { data } = useFetch('/api/subjects');

  return (
    <div className="mb-6 flex items-center gap-3">
      <label htmlFor="subject-filter" className="text-sm font-medium text-ink-soft">{t('subjects.subject')}</label>
      <select id="subject-filter" className="field !w-auto" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('subjects.all')}</option>
        {(data?.subjects ?? []).map((s) => <option key={s.id} value={s.id}>{subjectName(s, i18n.language)}</option>)}
      </select>
    </div>
  );
};

export default SubjectFilter;
