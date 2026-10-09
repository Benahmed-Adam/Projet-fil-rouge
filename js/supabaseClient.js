import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://tigbsbpetoydhcchpzjm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cYjf8o1KTzn53rZxJzNr8g_DepqXEEF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function isSessionActive() {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
        return false;
    }

    return true;
}