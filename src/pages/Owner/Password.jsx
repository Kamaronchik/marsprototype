import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PageHeader from '../../components/PageHeader';
import { api, errorText } from '../../lib/api';

// The CEO or the auditor changes their own password. Other devices are signed out.
const Password = () => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const mismatch = repeat !== '' && next !== repeat;

  const submit = async (event) => {
    event.preventDefault();
    if (next !== repeat) return;
    setSaving(true);
    try {
      await api('/api/owner/password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      toast.success(t('owner.passwordChanged'));
      setCurrent('');
      setNext('');
      setRepeat('');
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title={t('owner.passwordTitle')}>{t('owner.passwordHint')}</PageHeader>
      <form onSubmit={submit} className="max-w-md space-y-4 rounded-xl border border-line bg-card p-5">
        <div>
          <label htmlFor="p-cur" className="field-label">{t('owner.currentPassword')}</label>
          <input id="p-cur" type="password" autoComplete="current-password" className="field" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="p-new" className="field-label">{t('owner.password')}</label>
          <input id="p-new" type="password" autoComplete="new-password" className="field" minLength="12" value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="p-rep" className="field-label">{t('owner.repeatPassword')}</label>
          <input id="p-rep" type="password" autoComplete="new-password" className="field" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
          {mismatch && <p className="mt-1 text-xs text-brick">{t('owner.passwordMismatch')}</p>}
        </div>
        <button className="btn-primary" disabled={saving || mismatch}>{t('owner.save')}</button>
      </form>
    </>
  );
};

export default Password;
