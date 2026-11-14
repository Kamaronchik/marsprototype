import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PageHeader from '../../components/PageHeader';
import { SkeletonText } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { api, errorText } from '../../lib/api';

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const RECIPIENTS = ['Teacher', 'AcademicManager', 'Admin', 'Owner'];

// One rule: on or off, how serious, and the chain: after how many minutes whom to tell.
const RuleCard = ({ rule, onSaved }) => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(rule.enabled);
  const [severity, setSeverity] = useState(rule.severity);
  const [levels, setLevels] = useState(rule.levels);
  const [saving, setSaving] = useState(false);

  const changeLevel = (index, change) => setLevels(levels.map((l, i) => (i === index ? { ...l, ...change } : l)));
  const toggleRole = (index, role) => {
    const to = levels[index].to;
    changeLevel(index, { to: to.includes(role) ? to.filter((r) => r !== role) : [...to, role] });
  };
  const addLevel = () => {
    const last = levels[levels.length - 1]?.afterMinutes ?? 0;
    setLevels([...levels, { afterMinutes: last + 60, to: ['Owner'] }]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/owner/rules/${rule.code}`, { method: 'PUT', body: { enabled, severity, levels } });
      toast.success(t('settings.saved'));
      onSaved();
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{t(`owner.rule.${rule.code}`)}</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">{t(`owner.ruleHint.${rule.code}`)}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {t('owner.enabled')}
        </label>
      </div>

      <div className="mt-4 max-w-xs">
        <label htmlFor={`sev-${rule.code}`} className="field-label">{t('owner.severity')}</label>
        <select id={`sev-${rule.code}`} className="field pr-8" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          {SEVERITIES.map((s) => <option key={s} value={s}>{t(`owner.severities.${s}`)}</option>)}
        </select>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-semibold text-ink">{t('owner.levels')}</h3>
      <ul className="space-y-3">
        {levels.map((level, index) => (
          <li key={index} className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-sunken/60 px-4 py-3 text-sm">
            <label className="flex items-center gap-2 text-ink">
              {t('owner.afterMinutes')}
              <input
                type="number" min="0" max="10080" className="field w-24"
                value={level.afterMinutes} onChange={(e) => changeLevel(index, { afterMinutes: Number(e.target.value) })}
              />
            </label>
            {RECIPIENTS.map((role) => (
              <label key={role} className="flex items-center gap-1.5 text-ink-soft">
                <input type="checkbox" checked={level.to.includes(role)} onChange={() => toggleRole(index, role)} />
                {t(`roles.${role}`)}
              </label>
            ))}
            {levels.length > 1 && (
              <button className="ml-auto text-brick" onClick={() => setLevels(levels.filter((_, i) => i !== index))}>{t('owner.removeLevel')}</button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        {levels.length < 5 && <button className="btn-quiet" onClick={addLevel}>{t('owner.addLevel')}</button>}
        <button className="btn-primary" onClick={save} disabled={saving}>{t('owner.save')}</button>
      </div>
    </section>
  );
};

// The owner changes the thresholds and the chain of escalation. Every change is written to the journal.
const Rules = () => {
  const { t } = useTranslation();
  const rules = useFetch('/api/owner/rules');

  return (
    <>
      <PageHeader title={t('owner.rulesTitle')}>{t('owner.rulesHint')}</PageHeader>
      {rules.loading && <SkeletonText height="10rem" />}
      <div className="space-y-5">
        {(rules.data?.rules ?? []).map((rule) => <RuleCard key={rule.code + rule.updatedAt} rule={rule} onSaved={rules.reload} />)}
      </div>
    </>
  );
};

export default Rules;
