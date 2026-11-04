const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Ensure environment variables are loaded
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || 'placeholder-key';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.warn('⚠️ [Supabase] Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment variables. Database queries will not succeed until set.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
