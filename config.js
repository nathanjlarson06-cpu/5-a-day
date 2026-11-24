// Paste your two values from Supabase: Project Settings -> API (or "Connect" -> App frameworks).
// The anon / publishable key is meant to be public. Your data is protected by the rules in supabase/schema.sql.
// Never put the "service_role" / secret key here.
window.FIVE_CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_URL",          // looks like https://abcdefghijkl.supabase.co
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY", // a long string starting with eyJ... or sb_publishable_...
  googleSignIn: false                        // set to true after turning on Google under Authentication -> Providers
};
