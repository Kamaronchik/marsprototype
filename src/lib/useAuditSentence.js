import { useTranslation } from 'react-i18next';

// "Who did what": the action code of a journal entry is turned into a plain sentence.
// Unknown codes are shown as they are. Used by the journal of the school and by the owner's panel.
export const useAuditSentence = () => {
  const { t } = useTranslation();
  const word = (value) => (typeof value === 'string' ? t(`audit.values.${value}`, { defaultValue: value }) : value);

  return (entry) => {
    const d = entry.details ?? {};
    return t(`audit.actions.${entry.action}`, {
      defaultValue: entry.action,
      target: entry.targetName ?? d.name ?? '',
      from: word(d.from),
      to: word(d.to),
      status: word(d.status),
      role: word(d.role),
      amount: d.amount ?? d.after?.amount ?? '',
      title: d.title ?? '',
      date: d.date ?? '',
      group: d.groupName ?? '',
      code: d.code ?? '',
      path: d.path ?? '',
      category: d.category ? t(`expenses.categories.${d.category}`, { defaultValue: d.category }) : '',
    });
  };
};
