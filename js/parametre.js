import { supabase, isSessionActive } from './supabaseClient.js';

if (!(await isSessionActive())) {
    window.location.href= "index.html";
}

document.getElementById("btn-deconnexion").addEventListener('click', async (e) => {
    const { error } = await supabase.auth.signOut({ scope: 'local' })

    if (error) {
        console.log("Erreur lors de la deconnexion : ", error);
    }

    window.location.href= "index.html";
});

document.getElementById("btn-suppression").addEventListener('click', async (e) => {
    // plus tard...
});