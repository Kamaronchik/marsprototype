// The name of a subject in the user's language; falls back to the main name.
export const subjectName = (subject, language) => {
  if (!subject) return '';
  const byLanguage = { ru: subject.nameRu, uz: subject.nameUz, en: subject.nameEn }[(language || 'en').slice(0, 2)];
  return byLanguage || subject.name;
};
