// A subject as the browser gets it. Used by the subject list and inside group data.
const SUBJECT_COLUMNS = 'id, name, name_ru, name_uz, name_en';

const toSubject = (s) => ({ id: s.id, name: s.name, nameRu: s.name_ru, nameUz: s.name_uz, nameEn: s.name_en });

module.exports = { SUBJECT_COLUMNS, toSubject };
