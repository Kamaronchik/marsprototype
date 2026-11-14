import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FileText } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { SkeletonCard } from '../../components/Skeleton';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { formatDateTime } from '../../lib/format';

const STATUSES = ['new', 'viewed', 'interview', 'accepted', 'rejected'];
const ACCOUNT_ROLES = ['Teacher', 'AcademicManager', 'Financier'];

const looksLikeEmail = (text) => /^\S+@\S+\.\S+$/.test(text);

// One candidate: the data, the resume, the notes, the status. Only the Admin accepts and makes accounts.
const Details = ({ id, isAdmin, onClose, onChanged }) => {
  const { t, i18n } = useTranslation();
  const { data, reload } = useFetch(`/api/careers/applications/${id}`);
  const [note, setNote] = useState('');
  const [account, setAccount] = useState(null); // the form, then the one-time password
  const [created, setCreated] = useState(null);

  const application = data?.application;
  const statuses = STATUSES.filter((s) => isAdmin || s !== 'accepted');
  const locked = application?.status === 'accepted' && !isAdmin;

  const run = async (action, success) => {
    try {
      const result = await action();
      if (success) toast.success(success);
      return result;
    } catch (error) {
      toast.error(errorText(t, error));
      return null;
    }
  };

  const openResume = async () => {
    const result = await run(() => api(`/api/careers/applications/${id}/resume`));
    if (result) window.open(result.url, '_blank', 'noopener');
  };

  const setStatus = async (status) => {
    if (await run(() => api(`/api/careers/applications/${id}/status`, { method: 'PATCH', body: { status } }), t('common.success_save'))) {
      reload();
      onChanged();
    }
  };

  const addNote = async (event) => {
    event.preventDefault();
    if (await run(() => api(`/api/careers/applications/${id}/notes`, { method: 'POST', body: { text: note } }))) {
      setNote('');
      reload();
    }
  };

  const createAccount = async (event) => {
    event.preventDefault();
    const result = await run(() => api(`/api/careers/applications/${id}/account`, { method: 'POST', body: account }));
    if (result) {
      setCreated(result);
      setAccount(null);
      reload();
      onChanged();
    }
  };

  return (
    <Modal title={application?.fullName ?? '...'} onClose={onClose} size="lg">
      {!application && <SkeletonCard lines={3} />}
      {application && (
        <div className="space-y-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase text-ink-faint">{t('applications.contact')}</dt><dd className="text-ink">{application.contact}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-ink-faint">{t('applications.position')}</dt><dd className="text-ink">{application.position}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-ink-faint">{t('applications.received')}</dt><dd className="text-ink">{formatDateTime(application.createdAt, i18n.language)}</dd></div>
            <div>
              <dt className="text-xs font-semibold uppercase text-ink-faint">{t('applications.status')}</dt>
              <dd>
                <select className="field !w-auto !py-1.5" value={application.status} disabled={locked} onChange={(e) => setStatus(e.target.value)}>
                  {statuses.map((s) => <option key={s} value={s}>{t(`applications.statuses.${s}`)}</option>)}
                </select>
              </dd>
            </div>
          </dl>
          {application.message && <p className="whitespace-pre-line rounded-lg bg-sunken/60 p-3 text-sm text-ink">{application.message}</p>}
          {application.hasResume && <button className="btn-quiet" onClick={openResume}><FileText size={16} /> {t('applications.resume')}</button>}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('applications.notes')}</h3>
            <ul className="space-y-2">
              {(data.notes ?? []).map((n) => (
                <li key={n.id} className="rounded-lg border border-line p-3 text-sm">
                  <p className="whitespace-pre-line text-ink">{n.text}</p>
                  <p className="mt-1 text-xs text-ink-faint">{n.authorName} · {formatDateTime(n.createdAt, i18n.language)}</p>
                </li>
              ))}
              {data.notes.length === 0 && <li className="text-sm text-ink-soft">{t('applications.noNotes')}</li>}
            </ul>
            <form onSubmit={addNote} className="mt-3 flex gap-2">
              <input className="field" maxLength={2000} placeholder={t('applications.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn-primary" disabled={!note.trim()}>{t('applications.addNote')}</button>
            </form>
          </div>

          {isAdmin && application.status === 'accepted' && !application.accountCreated && !created && !account && (
            <button className="btn-primary" onClick={() => setAccount({ username: '', email: looksLikeEmail(application.contact) ? application.contact : '', role: 'Teacher' })}>
              {t('applications.createAccount')}
            </button>
          )}
          {application.accountCreated && !created && <p className="text-sm text-moss">{t('applications.accountCreated')}</p>}

          {account && (
            <form onSubmit={createAccount} className="space-y-3 rounded-lg border border-line p-4">
              <p className="text-sm text-ink-soft">{t('applications.accountHint')}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="acc-username" className="field-label">{t('peoplePage.username')}</label>
                  <input id="acc-username" className="field" value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="acc-email" className="field-label">{t('common.email')}</label>
                  <input id="acc-email" type="email" className="field" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="acc-role" className="field-label">{t('peoplePage.role')}</label>
                  <select id="acc-role" className="field" value={account.role} onChange={(e) => setAccount({ ...account, role: e.target.value })}>
                    {ACCOUNT_ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="btn-quiet" onClick={() => setAccount(null)}>{t('common.cancel')}</button>
                <button className="btn-primary" disabled={!account.username || !account.email}>{t('applications.createAccount')}</button>
              </div>
            </form>
          )}

          {created && (
            <div className="rounded-lg border border-moss bg-moss-tint p-4 text-sm text-ink">
              <p className="font-semibold">{t('applications.accountReady')}</p>
              <p className="mt-1">{t('peoplePage.username')}: <b>{created.user.username}</b></p>
              <p>{t('applications.tempPassword')}: <b className="select-all font-mono">{created.temporaryPassword}</b></p>
              <p className="mt-2 text-xs text-ink-soft">{t('applications.shownOnce')}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

// Academic Manager and Admin: people who applied for a job (the Careers site sends them here).
const Applications = () => {
  const { t, i18n } = useTranslation();
  const isAdmin = useSelector((state) => state.auth.user?.role) === 'Admin';
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState(null);
  const list = useFetch(`/api/careers/applications${status ? `?status=${status}` : ''}`);
  const applications = list.data?.applications ?? [];

  return (
    <>
      <PageHeader title={t('applications.title')}>{t('applications.hint')}</PageHeader>

      <div className="mb-5">
        <label htmlFor="app-status" className="field-label">{t('applications.status')}</label>
        <select id="app-status" className="field !w-auto pr-8" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('applications.allStatuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`applications.statuses.${s}`)}</option>)}
        </select>
      </div>

      {list.loading && <SkeletonCard lines={3} />}
      {!list.loading && applications.length === 0 && <p className="text-sm text-ink-soft">{t('applications.empty')}</p>}

      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {applications.map((a) => (
          <li key={a.id}>
            <button className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-left hover:bg-sunken/40" onClick={() => setOpenId(a.id)}>
              <span>
                <span className="block font-semibold text-ink">{a.fullName}</span>
                <span className="block text-sm text-ink-soft">{a.position} · {a.contact}</span>
              </span>
              <span className="text-right text-xs text-ink-soft">
                <span className="block font-semibold text-ink">{t(`applications.statuses.${a.status}`)}</span>
                {formatDateTime(a.createdAt, i18n.language)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {openId && <Details id={openId} isAdmin={isAdmin} onClose={() => setOpenId(null)} onChanged={list.reload} />}
    </>
  );
};

export default Applications;
