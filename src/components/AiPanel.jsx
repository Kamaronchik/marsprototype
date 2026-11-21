import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Sparkles, PenLine } from 'lucide-react';
import Modal from './Modal';
import { api, errorText } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { formatDateTime } from '../lib/format';

// The AI block of the academic manager for one student, teacher or group.
//   "Update analysis": the server counts the numbers, the AI explains them, the result is saved.
//   "Write with AI": the AI writes a draft from the saved analysis. A person edits it and presses Send.
// If the AI is not available, the block says so and everything else on the page keeps working.
const AiPanel = ({ type, targetId }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language.slice(0, 2);
  const saved = useFetch(`/api/academic/reports/${type}/${targetId}`);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);

  const shown = report ?? saved.data?.report;

  const update = async () => {
    setBusy(true);
    try {
      const data = await api(`/api/academic/reports/${type}/${targetId}/refresh`, { method: 'POST', body: { language } });
      setReport(data.report);
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setBusy(false);
    }
  };

  const write = async () => {
    setBusy(true);
    try {
      const data = await api('/api/academic/draft', { method: 'POST', body: { type, targetId, language } });
      setDraft(data.draft);
    } catch (error) {
      toast.error(errorText(t, error));
      // Without the AI the person can still write the message by hand.
      if (error.code === 'AI_UNAVAILABLE') setDraft('');
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    try {
      const data = await api('/api/academic/send', { method: 'POST', body: { type, targetId, text: draft } });
      toast.success(t('academic.sent', { count: data.sent, telegram: data.telegram }));
      setDraft(null);
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <div className="rounded-lg border border-line bg-sunken p-4">
      {shown && (
        <>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{shown.text}</p>
          <p className="mt-2 text-xs text-ink-faint">{t('academic.analysisFrom', { date: formatDateTime(shown.createdAt, i18n.language) })}</p>
        </>
      )}
      {!shown && !saved.loading && <p className="text-sm text-ink-soft">{t('academic.noAnalysis')}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-quiet !py-2" disabled={busy} onClick={update}><Sparkles size={15} /> {t('academic.update')}</button>
        <button className="btn-quiet !py-2" disabled={busy} onClick={write}><PenLine size={15} /> {t('academic.writeWithAi')}</button>
      </div>

      {draft !== null && (
        <Modal title={t('academic.draftTitle')} onClose={() => setDraft(null)}>
          <p className="mb-3 text-sm text-ink-soft">{t('academic.draftHint')}</p>
          <textarea className="field" rows={8} maxLength={1500} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="mt-4 flex justify-end gap-3">
            <button className="btn-quiet" onClick={() => setDraft(null)}>{t('common.cancel')}</button>
            <button className="btn-primary" disabled={!draft.trim()} onClick={send}>{t('academic.send')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AiPanel;
