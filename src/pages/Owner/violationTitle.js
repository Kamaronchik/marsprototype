// The short name of a violation (or of its fine).
// A penalty from an auditor: "Rule 3.2 · Phone during the lesson". A violation of the engine: "Attendance not marked: Group A".
export const isPenalty = (item) => item.details?.source === 'audit';

export const violationTitle = (t, item) => {
  if (isPenalty(item)) {
    return t('penalty.ruleTitle', { number: item.details.ruleNumber, text: t(`penalty.rule.${item.ruleCode}`) });
  }
  return `${t(`owner.rule.${item.ruleCode}`)}: ${item.details?.groupName ?? ''}`;
};
