import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True when the build was given Supabase credentials. A missing value is a
 * setup mistake, not a runtime error — the app renders an explanatory screen
 * rather than a blank page with a console stack trace.
 */
export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder',
  {
    auth: {
      // PKCE puts the token in `?code=` rather than the URL fragment. That
      // matters here: HashRouter owns the fragment, and the default implicit
      // flow would drop `#access_token=...` straight into a route it can't
      // parse. Sign-in codes are the main path regardless (see SignIn.tsx).
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)
