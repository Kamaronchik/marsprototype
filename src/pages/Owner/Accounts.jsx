import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PageHeader from '../../components/PageHeader';
import { SkeletonText } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { api, errorText } from '../../lib/api';

const ROLES = ['Admin', 'AcademicManager', 'Financier', 'Auditor'];
const EMPTY = { username: '', email: '', fullName: '', password: '', role: 'Admin' };

// A form: the CEO makes a new Admin, Financier or Auditor.
const NewAccount = ({ onCreated }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api('/api/owner/accounts', { method: 'POST', body: form });
      toast.success(t('settings.saved'));
      setForm(EMPTY);
      onCreated();
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-8 grid gap-4 rounded-xl border border-line bg-card p-5 md:grid-cols-2">
      <div>
        <label htmlFor="a-role" className="field-label">{t('owner.role')}</label>
        <select id="a-role" className="field pr-8" value={form.role} onChange={set('role')}>
          {ROLES.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="a-name" className="field-label">{t('owner.fullName')}</label>
        <input id="a-name" className="field" value={form.fullName} onChange={set('fullName')} required />
      </div>
      <div>
        <label htmlFor="a-user" className="field-label">{t('owner.username')}</label>
        <input id="a-user" className="field" value={form.username} onChange={set('username')} required />
      </div>
      <div>
        <label htmlFor="a-email" className="field-label">{t('owner.email')}</label>
        <input id="a-email" type="email" className="field" value={form.email} onChange={set('email')} required />
      </div>
      <div>
        <label htmlFor="a-pass" className="field-label">{t('owner.password')}</label>
        <input id="a-pass" type="password" autoComplete="new-password" className="field" value={form.password} onChange={set('password')} minLength="12" required />
      </div>
      <div className="flex items-end">
        <button className="btn-primary" disabled={saving}>{t('owner.createAccount')}</button>
      </div>
    </form>
  );
};

// One row: block or unblock, and a new password.
const AccountRow = ({ account, onChanged }) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const blocked = account.status === 'blocked';

  const change = async (body) => {
    try {
      await api(`/api/owner/accounts/${account.id}`, { method: 'PATCH', body });
      toast.success(t('settings.saved'));
      setPassword('');
      onChanged();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <tr>
      <td className="px-5 py-3 text-sm font-semibold text-ink">
        {account.fullName}
        <span className="block text-xs font-normal text-ink-faint">{account.username} · {account.email}</span>
      </td>
      <td className="px-5 py-3 text-sm text-ink-soft">{t(`roles.${account.role}`)}</td>
      <td className={`px-5 py-3 text-sm ${blocked ? 'font-semibold text-brick' : 'text-moss'}`}>{t(`audit.values.${account.status}`)}</td>
      <td className="px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-quiet !py-1.5" onClick={() => change({ status: blocked ? 'active' : 'blocked' })}>
            {t(blocked ? 'owner.unblock' : 'owner.block')}
          </button>
          <input
            type="password" autoComplete="new-password" className="field !w-40 !py-1.5" placeholder={t('owner.newPassword')}
            aria-label={t('owner.newPassword')} value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn-quiet !py-1.5" disabled={password.length < 12} onClick={() => change({ password })}>{t('owner.setPassword')}</button>
        </div>
      </td>
    </tr>
  );
};

// The CEO creates and manages the accounts of the Admin, the Financier and the Auditor.
const Accounts = () => {
  const { t } = useTranslation();
  const accounts = useFetch('/api/owner/accounts');
  const rows = accounts.data?.accounts ?? [];

  return (
    <>
      <PageHeader title={t('owner.accountsTitle')}>{t('owner.accountsHint')}</PageHeader>
      <NewAccount onCreated={accounts.reload} />

      {accounts.loading && <SkeletonText height="6rem" />}
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('audit.who')}</th>
              <th className="px-5 py-3">{t('owner.role')}</th>
              <th className="px-5 py-3">{t('owner.statusLabel')}</th>
              <th className="px-5 py-3">{t('owner.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((account) => <AccountRow key={account.id + account.status} account={account} onChanged={accounts.reload} />)}
            {!accounts.loading && rows.length === 0 && (
              <tr><td colSpan="4" className="px-5 py-12 text-center text-sm text-ink-soft">{t('owner.noAccounts')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Accounts;
