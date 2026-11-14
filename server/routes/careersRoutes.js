const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { limiter } = require('../utils/rateLimit');
const {
  apply, listApplications, getApplication, getResumeLink, addNote, setStatus, createAccount,
} = require('../controllers/careersController');

// Public form: few applications per visitor, and the resume stays in memory (up to 4 MB, one file).
const applyLimiter = limiter(5, 'Too many applications. Try again later.');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 10 } });

const readResume = (req, res, next) => {
  upload.single('resume')(req, res, (error) => {
    if (!error) return next();
    const tooBig = error.code === 'LIMIT_FILE_SIZE';
    res.status(tooBig ? 413 : 400).json({ message: tooBig ? 'The resume is too big (up to 4 MB)' : 'Invalid form' });
  });
};

router.post('/apply', applyLimiter, readResume, apply);

// Everything below is the CRM part: Academic Manager and Admin.
router.use(authMiddleware, requireRole('Admin', 'AcademicManager'));

router.get('/applications', listApplications);
router.get('/applications/:id', getApplication);
router.get('/applications/:id/resume', getResumeLink);
router.post('/applications/:id/notes', addNote);
router.patch('/applications/:id/status', setStatus);

// Only the Admin makes accounts.
router.post('/applications/:id/account', requireRole('Admin'), createAccount);

module.exports = router;
