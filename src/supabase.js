import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kjtvirsaiopyybkhtajj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jILyikhhDqe3C1AvKCwH4g_Zccyv8O0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);