// One shared Supabase client, loaded only when a page needs it.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '/config.js';

let client;
export function supabase() {
  client ??= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
  return client;
}
