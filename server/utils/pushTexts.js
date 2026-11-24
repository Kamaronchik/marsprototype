// Texts of browser push notifications. Only the types listed here are sent as a push.
// {{name}} is filled from the notification data. reason gets brackets around it, like in the bell.
const TEXTS = {
  ru: {
    title: 'Mars Space',
    'penalty.received': 'Вы нарушили правило {{rule}} внутренних правил менторов. Пожалуйста, соблюдайте правила',
    'penalty.removed': 'Наказание по правилу {{rule}} снято{{reason}}',
  },
  uz: {
    title: 'Mars Space',
    'penalty.received': "Siz mentorlar ichki qoidasining {{rule}}-bandini buzdingiz. Iltimos, qoidalarga amal qiling",
    'penalty.removed': "{{rule}}-qoida bo'yicha jazo olib tashlandi{{reason}}",
  },
  en: {
    title: 'Mars Space',
    'penalty.received': 'You broke rule {{rule}} of the internal rules for mentors. Please follow the rules',
    'penalty.removed': 'The penalty for rule {{rule}} was taken back{{reason}}',
  },
};

const hasPushText = (type) => Boolean(TEXTS.ru[type]);

const pushText = (language, type, data = {}) => {
  const texts = TEXTS[language] ?? TEXTS.ru;
  const values = { ...data, reason: data.reason ? ` (${data.reason})` : '' };
  const body = texts[type].replace(/\{\{(\w+)\}\}/g, (all, key) => (values[key] ?? '').toString());
  return { title: texts.title, body };
};

module.exports = { hasPushText, pushText };
