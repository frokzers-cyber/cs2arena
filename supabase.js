const SUPABASE_URL = 'https://ukkywsizdwygesjqnsvy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_eBtVCzhaTDlrhQV4eaXnLQ_Jnm7V-vT';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

window.sb = sb;