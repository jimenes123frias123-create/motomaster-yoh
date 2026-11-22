import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://xnfsngkmgivideqvxhzb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7QXlAEGxxBpJU8TMP89JEA_ygSKshoi';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);