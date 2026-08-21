import { createClient } from '@supabase/supabase-js';

/* ---- Supabase project config ----
   Fill these in from Settings > API in your Supabase project (or use a
   .env file with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), then redeploy.
   The anon/public key is safe to expose in client code — access is
   controlled by the Row Level Security policies set up in your SQL schema. */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR-ANON-PUBLIC-KEY';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
