import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = 'https://eakakbgpkimrlrjaeisa.supabase.co';
// Anonymous key fallback or environment variable
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVha2FrYmdwa2ltcmxyamFlaXNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxOTgwMDAsImV4cCI6MjA1Mzc3NDAwMH0.placeholder';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SUPABASE_CONNECTION_STRING = 'postgresql://postgres:[YOUR-PASSWORD]@db.eakakbgpkimrlrjaeisa.supabase.co:5432/postgres';
