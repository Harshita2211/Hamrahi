import { createClient } from '@supabase/supabase-js';

let client = null;

const getClient = () => {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    });
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