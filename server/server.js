const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');

// Load environment variables from either root .env or server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const walletRoutes = require('./routes/walletRoutes');
const shopRoutes = require('./routes/shopRoutes');
const adminShopRoutes = require('./routes/adminShopRoutes');
const groupRoutes = require('./routes/groupRoutes');
const studentRoutes = require('./routes/studentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const financeRoutes = require('./routes/financeRoutes');
const battleRoutes = require('./routes/battleRoutes');
const translationRoutes = require('./routes/translationRoutes');
const homeRoutes = require('./routes/homeRoutes');
const telegramRoutes = require('./routes/telegramRoutes');
const adminTelegramRoutes = require('./routes/adminTelegramRoutes');
const homeworkRoutes = require('./routes/homeworkRoutes');
const gradeRoutes = require('./routes/gradeRoutes');
const tutorRoutes = require('./routes/tutorRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const academicRoutes = require('./routes/academicRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const auditRoutes = require('./routes/auditRoutes');
const careersRoutes = require('./routes/careersRoutes');

const app = express();

// Vercel (and most hosts) sit behind a proxy: needed so rate limits see the real client IP.
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
// The site, and the Careers site (it only needs POST /api/careers/apply: the session cookie is SameSite=lax,
// so it is never sent from another site anyway).
const allowedOrigins = [process.env.CLIENT_URL || 'http://localhost:5173', process.env.CAREERS_URL].filter(Boolean);
app.use(cors({
  origin: (origin, done) => done(null, !origin || allowedOrigins.includes(origin)),
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admin/shop', adminShopRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/battles', battleRoutes);
app.use('/api/i18n', translationRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/admin/telegram', adminTelegramRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/careers', careersRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Mars Space Backend is running' });
});

// Anything that goes wrong inside a handler (for example the database does not answer) is answered
// in JSON, like every other error, so the site can show a message instead of a broken page.
// eslint-disable-next-line no-unused-vars -- Express recognises an error handler by its four arguments
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ message: 'Database error' });
});

// Export app for Vercel Serverless Functions
module.exports = app;

// Start server directly only when executed via CLI (not imported by Vercel serverless function)
if (require.main === module && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Mars Space Server running on port ${PORT}`);
  });
}
