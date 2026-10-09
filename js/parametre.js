import { supabase, isSessionActive } from './supabaseClient.js';

if (!(await isSessionActive())) {
    window.location.href= "index.html";
}

document.getElementById()