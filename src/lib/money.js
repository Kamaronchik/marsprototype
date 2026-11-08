import { localeOf } from './format';

// 1500000 -> "1 500 000 сум" in the user's language.
export const formatMoney = (amount, language, t) =>
  `${new Intl.NumberFormat(localeOf(language)).format(amount)} ${t('finance.currency')}`;
