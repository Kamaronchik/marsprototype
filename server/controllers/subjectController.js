const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { logAction } = require('../utils/audit');
const { SUBJECT_COLUMNS: COLUMNS, toSubject: toClient } = require('../utils/subjects');

const clean = (text) => (typeof text === 'string' ? text.trim() : '');

// Reads and checks the fields of the form. Returns { fields } or { problem }.
const readFields = (body, { partial }) => {
  const fields = {};
  if (!partial || body.name !== undefined) {
    const name = clean(body.name);
    if (!name || name.length > 60) return { problem: 'Name: 1-60 characters' };
    fields.name = name;
  }
  for (const [key, column] of [['nameRu', 'name_ru'], ['nameUz', 'name_uz'], ['nameEn', 'name_en']]) {
    if (body[key] === undefined) continue;
    const text = clean(body[key]);
    if (text.length > 60) return { problem: 'Name: 1-60 characters' };
    fields[column] = text || null;
  }
  return { fields };
};

const dbError = (error, res) => {
  if (error.code === '23505') return res.status(409).json({ message: 'A subject with this name already exists', code: 'NAME_TAKEN' });
  return handleDbError(error, res);
};

// Everybody who may see a group may see the subject list (for the group form and the filter).
const listSubjects = async (req, res) => {
  const { data, error } = await supabase.from('subjects').select(`${COLUMNS}, groups(count)`).order('name');
  if (error) return handleDbError(error, res);
  res.json({ subjects: data.map((s) => ({ ...toClient(s), groupCount: s.groups?.[0]?.count ?? 0 })) });
};

const createSubject = async (req, res) => {
  const { fields, problem } = readFields(req.body, { partial: false });
  if (problem) return res.status(400).json({ message: problem });

  const { data, error } = await supabase.from('subjects').insert(fields).select(COLUMNS).single();
  if (error) return dbError(error, res);

  await logAction(req.user.id, 'subject.create', 'subject', data.id, { name: data.name });
  res.status(201).json({ subject: toClient(data) });
};

const updateSubject = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });
  const { fields, problem } = readFields(req.body, { partial: true });
  if (problem) return res.status(400).json({ message: problem });
  if (!Object.keys(fields).length) return res.status(400).json({ message: 'Nothing to update' });

  const { data, error } = await supabase.from('subjects').update(fields).eq('id', id).select(COLUMNS).maybeSingle();
  if (error) return dbError(error, res);
  if (!data) return res.status(404).json({ message: 'Subject not found' });

  await logAction(req.user.id, 'subject.update', 'subject', id, fields);
  res.json({ subject: toClient(data) });
};

// The groups of a deleted subject stay: they just have no subject any more.
const deleteSubject = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });

  const { data, error } = await supabase.from('subjects').delete().eq('id', id).select('id, name').maybeSingle();
  if (error) return dbError(error, res);
  if (!data) return res.status(404).json({ message: 'Subject not found' });

  await logAction(req.user.id, 'subject.delete', 'subject', id, { name: data.name });
  res.json({ message: 'Subject deleted' });
};

module.exports = { listSubjects, createSubject, updateSubject, deleteSubject };
