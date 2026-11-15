import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LoginTools from '../../features/auth/LoginTools';
import { messageText } from '../../lib/api';

const POSITIONS = ['intern', 'teacher'];
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const EMPTY = { fullName: '', email: '', position: 'intern', strength: '', website: '' };

// The public job application form: anybody can open it from the login page, no account is needed.
// The answer comes later by e-mail, after the Admin accepts or rejects the candidate.
const Apply = () => {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [resume, setResume] = useState(null);
  const [problem, setProblem] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const pickFile = (event) => {
    const file = event.target.files[0] ?? null;
    setProblem(file && file.size > MAX_FILE_BYTES ? t('apply.fileTooBig') : '');
    setResume(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (resume && resume.size > MAX_FILE_BYTES) return;
    setSending(true);
    setProblem('');

    // A file cannot travel as JSON, so the form is sent the way a browser sends forms.
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    body.append('language', (i18n.resolvedLanguage || i18n.language || 'ru').slice(0, 2));
    if (resume) body.append('resume', resume);

    try {
      const response = await fetch('/api/careers/apply', { method: 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (response.ok) setSent(true);
      else setProblem(messageText(t, data.message || 'Request failed'));
    } catch {
      setProblem(t('errors.NETWORK'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center overflow-hidden">
      <LoginTools />
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-start gap-10 px-5 pb-12 pt-24 lg:grid-cols-[1fr_1.1fr] lg:px-10">
        <div className="lg:pt-10">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink lg:text-[3rem]">{t('apply.title')}</h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">{t('apply.text')}</p>
          <Link to="/login" className="mt-6 inline-block text-sm text-mars">{t('apply.backToLogin')}</Link>
        </div>

        <section className="w-full max-w-lg justify-self-center rounded-2xl border border-line bg-card p-8 shadow-xl lg:justify-self-end">
          {sent ? (
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink">{t('apply.sentTitle')}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{t('apply.sentText', { email: form.email })}</p>
              <Link to="/login" className="btn-quiet mt-6">{t('apply.backToLogin')}</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="ap-name" className="field-label">{t('apply.fullName')}</label>
                <input id="ap-name" className="field" value={form.fullName} onChange={set('fullName')} minLength="2" maxLength="100" autoComplete="name" required />
              </div>
              <div>
                <label htmlFor="ap-email" className="field-label">{t('apply.email')}</label>
                <input id="ap-email" type="email" className="field" placeholder="name@gmail.com" value={form.email} onChange={set('email')} maxLength="100" autoComplete="email" required />
              </div>
              <div>
                <label htmlFor="ap-position" className="field-label">{t('apply.position')}</label>
                <select id="ap-position" className="field pr-8" value={form.position} onChange={set('position')}>
                  {POSITIONS.map((p) => <option key={p} value={p}>{t(`applications.positions.${p}`)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ap-strength" className="field-label">{t('apply.strength')}</label>
                <textarea id="ap-strength" className="field" rows="4" minLength="10" maxLength="2000" placeholder={t('apply.strengthHint')} value={form.strength} onChange={set('strength')} required />
              </div>
              <div>
                <label htmlFor="ap-resume" className="field-label">{t('apply.resume')}</label>
                <input id="ap-resume" type="file" accept=".pdf,.doc,.docx" className="block w-full text-sm text-ink-soft" onChange={pickFile} required />
                <p className="mt-1 text-xs text-ink-faint">{t('apply.resumeHint')}</p>
              </div>

              {/* A trap for simple bots: people never see or fill this field. */}
              <input type="text" name="website" tabIndex="-1" autoComplete="off" className="hidden" value={form.website} onChange={set('website')} aria-hidden="true" />

              {problem && <p role="alert" className="rounded-lg bg-brick-tint px-3 py-2 text-sm text-brick">{problem}</p>}
              <button className="btn-primary w-full" disabled={sending || !!(resume && resume.size > MAX_FILE_BYTES)}>
                {t(sending ? 'apply.sending' : 'apply.submit')}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};

export default Apply;
