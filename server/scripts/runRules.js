// Runs the audit rules once and prints what happened:  npm run run-rules
// The same thing the timer does (GET /api/cron/rules). Handy for a local check.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { runAttendanceRule } = require('../utils/violations');

runAttendanceRule()
  .then((result) => { console.log('Rules run:', result); process.exit(0); })
  .catch((error) => { console.error('Rules failed:', error.message); process.exit(1); });
