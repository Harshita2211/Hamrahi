import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client — clean proxy to the real SDK.
 * The broken custom wrapper (with only 4 methods) has been replaced.
 */

let supabaseClient = null;

const getSupabaseClient = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    });

    console.log('✅ Supabase client initialized');
  }
  return supabaseClient;
};

// Proxy — every property/method goes straight to the real Supabase client
const supabase = new Proxy({}, {
  get(_, prop) {
    const client = getSupabaseClient();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default supabase;
