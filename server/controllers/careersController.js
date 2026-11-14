const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { isUuid } = require('../utils/validate');
const { logAction } = require('../utils/audit');

const BUCKET = 'resumes';
const STATUSES = ['new', 'viewed', 'interview', 'accepted', 'rejected'];
const ACCOUNT_ROLES = ['Teacher', 'AcademicManager', 'Financier'];
const SIGNED_URL_SECONDS = 60;

// Resume files: the type is checked by the first bytes of the file, not by the name the sender gave it.
const FILE_TYPES = [
  { ext: 'pdf', mime: 'application/pdf', starts: Buffer.from('%PDF-') },
  { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', starts: Buffer.from('PK\u0003\u0004', 'latin1') },
  { ext: 'doc', mime: 'application/msword', starts: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]) },
];

const detectFile = (buffer) => FILE_TYPES.find((t) => buffer.length > 8 && buffer.subarray(0, t.starts.length).equals(t.starts));

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const toClient = (a) => ({
  id: a.id,
  fullName: a.full_name,
  contact: a.contact,
  position: a.position,
  message: a.message,
  hasResume: !!a.resume_path,
  status: a.status,
  accountCreated: !!a.account_user_id,
  createdAt: a.created_at,
});

const COLUMNS = 'id, full_name, contact, position, message, resume_path, status, account_user_id, created_at';

// --- Public: the Careers site sends an application here -----------------------------------------
// It answers only "ok": never any data, and nothing about other applications.
const apply = async (req, res) => {
  // A hidden field that people leave empty and simple bots fill in.
  if (text(req.body.website, 100)) return res.status(201).json({ message: 'Application received' });

  const fullName = text(req.body.fullName, 100);
  const contact = text(req.body.contact, 100);
  const position = text(req.body.position, 100);
  const message = text(req.body.message, 2000);
  if (fullName.length < 2) return res.status(400).json({ message: 'Name is required' });
  if (contact.length < 5) return res.status(400).json({ message: 'Contact is required (phone, Telegram or e-mail)' });
  if (position.length < 2) return res.status(400).json({ message: 'Choose a vacancy' });

  let resumePath = null;
  if (req.file) {
    const type = detectFile(req.file.buffer);
    if (!type) return res.status(400).json({ message: 'The resume must be a PDF or Word file' });
    resumePath = `${crypto.randomUUID()}.${type.ext}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(resumePath, req.file.buffer, { contentType: type.mime, upsert: false });
    if (uploadError) return handleDbError(uploadError, res);
  }

  const { data, error } = await supabase
    .from('job_applications')
    .insert({ full_name: fullName, contact, position, message: message || null, resume_path: resumePath })
    .select('id')
    .single();
  if (error) {
    if (resumePath) await supabase.storage.from(BUCKET).remove([resumePath]);
    return handleDbError(error, res);
  }

  await logAction(null, 'application.receive', 'application', data.id, { position });
  res.status(201).json({ message: 'Application received' });
};

// --- CRM: Academic Manager and Admin -------------------------------------------------------------

// ?status=new  ?q=text (name, contact or vacancy)
const listApplications = async (req, res) => {
  const { status, q } = req.query;
  if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  let query = supabase.from('job_applications').select(COLUMNS).order('created_at', { ascending: false }).limit(300);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return handleDbError(error, res);

  let applications = data.map(toClient);
  const needle = typeof q === 'string' ? q.trim().toLowerCase() : '';
  if (needle) {
    applications = applications.filter((a) => [a.fullName, a.contact, a.position].some((v) => v.toLowerCase().includes(needle)));
  }
  res.json({ applications });
};

const getApplication = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });

  const [{ data: application, error }, { data: notes }] = await Promise.all([
    supabase.from('job_applications').select(COLUMNS).eq('id', id).maybeSingle(),
    supabase.from('application_notes').select('id, text, created_at, author:users!application_notes_author_id_fkey(full_name)').eq('application_id', id).order('created_at'),
  ]);
  if (error) return handleDbError(error, res);
  if (!application) return res.status(404).json({ message: 'Application not found' });

  res.json({
    application: toClient(application),
    notes: (notes ?? []).map((n) => ({ id: n.id, text: n.text, createdAt: n.created_at, authorName: n.author?.full_name ?? null })),
  });
};

// A link to the resume that works for one minute. The bucket itself is private.
const getResumeLink = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });

  const { data: application } = await supabase.from('job_applications').select('resume_path').eq('id', id).maybeSingle();
  if (!application) return res.status(404).json({ message: 'Application not found' });
  if (!application.resume_path) return res.status(404).json({ message: 'This application has no resume' });

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(application.resume_path, SIGNED_URL_SECONDS);
  if (error) return handleDbError(error, res);
  await logAction(req.user.id, 'application.view_resume', 'application', id);
  res.json({ url: data.signedUrl, expiresIn: SIGNED_URL_SECONDS });
};

const addNote = async (req, res) => {
  const { id } = req.params;
  const body = text(req.body.text, 2000);
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });
  if (!body) return res.status(400).json({ message: 'Note text is required' });

  const { data: application } = await supabase.from('job_applications').select('id').eq('id', id).maybeSingle();
  if (!application) return res.status(404).json({ message: 'Application not found' });

  const { data, error } = await supabase
    .from('application_notes').insert({ application_id: id, author_id: req.user.id, text: body }).select('id, text, created_at').single();
  if (error) return handleDbError(error, res);

  await logAction(req.user.id, 'application.note', 'application', id);
  res.status(201).json({ note: { id: data.id, text: data.text, createdAt: data.created_at } });
};

// The Academic Manager may move a candidate between the steps; "accepted" is only for the Admin.
const setStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });
  if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' });
  if (status === 'accepted' && req.user.role !== 'Admin') return res.status(403).json({ message: 'Only the Admin can accept a candidate' });

  const { data: before } = await supabase.from('job_applications').select('status').eq('id', id).maybeSingle();
  if (!before) return res.status(404).json({ message: 'Application not found' });
  // An accepted candidate is not changed by the Academic Manager either.
  if (before.status === 'accepted' && req.user.role !== 'Admin') return res.status(403).json({ message: 'Only the Admin can change an accepted candidate' });

  const { data, error } = await supabase.from('job_applications').update({ status }).eq('id', id).select(COLUMNS).single();
  if (error) return handleDbError(error, res);

  await logAction(req.user.id, 'application.status', 'application', id, { from: before.status, to: status });
  res.json({ application: toClient(data) });
};

// Admin only, after "accepted": makes the account on purpose, one click, one time.
// The temporary password is shown once to the Admin, who gives it to the person. It is never stored in plain text.
const createAccount = async (req, res) => {
  const { id } = req.params;
  const { username, email, role } = req.body;
  if (!isUuid(id)) return res.status(400).json({ message: 'Invalid id' });
  if (!ACCOUNT_ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username || '')) return res.status(400).json({ message: 'Username: 3-30 chars (letters, digits . _ -)' });
  if (!/^\S+@\S+\.\S+$/.test((email || '').trim())) return res.status(400).json({ message: 'Invalid email' });

  const { data: application } = await supabase.from('job_applications').select('id, full_name, status, account_user_id').eq('id', id).maybeSingle();
  if (!application) return res.status(404).json({ message: 'Application not found' });
  if (application.status !== 'accepted') return res.status(409).json({ message: 'Accept the candidate first' });
  if (application.account_user_id) return res.status(409).json({ message: 'The account was already created' });

  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      full_name: application.full_name,
      password_hash: await bcrypt.hash(temporaryPassword, 12),
      role,
      status: 'active',
      email_verified: false,
    })
    .select('id, username, role')
    .single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Username already exists' });
    return handleDbError(error, res);
  }

  await supabase.from('job_applications').update({ account_user_id: user.id }).eq('id', id);
  await logAction(req.user.id, 'user.create', 'user', user.id, { role, fromApplication: id });
  await logAction(req.user.id, 'application.create_account', 'application', id, { role });
  res.status(201).json({ user: { id: user.id, username: user.username, role: user.role }, temporaryPassword });
};

module.exports = { apply, listApplications, getApplication, getResumeLink, addNote, setStatus, createAccount };
