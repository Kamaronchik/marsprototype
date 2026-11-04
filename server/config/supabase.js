const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Ensure environment variables are loaded
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://placeholder.supabase.co'
).trim();

const supabaseKey = (
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'placeholder-key'
).trim();

if (
  !process.env.SUPABASE_URL &&
  !process.env.VITE_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL
) {
  console.warn('⚠️ [Supabase] Missing SUPABASE_URL in environment variables. Database queries will not succeed until set.');
}

if (
  !process.env.SUPABASE_SECRET_KEY &&
  !process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !process.env.SUPABASE_KEY
) {
  console.warn('⚠️ [Supabase] Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
