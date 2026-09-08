import { createClient } from '@supabase/supabase-js';

let client = null;

const getClient = () => {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    client = createClient(url, key, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    });
    console.log('✅ Supabase client initialized');
  }
  return client;
};

export default new Proxy({}, {
  get(_, prop) {
    const c = getClient();
    const val = c[prop];
    return typeof val === 'function' ? val.bind(c) : val;
  },
});
