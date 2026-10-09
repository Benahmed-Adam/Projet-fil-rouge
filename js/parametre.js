import { supabase, isSessionActive } from './supabaseClient.js';
import { setMessage, setLoading } from './ui.js';

if (!(await isSessionActive())) {
    window.location.href = "index.html";
}

document.getElementById("btn-deconnexion").addEventListener('click', async () => {
    await supabase.auth.signOut({ scope: 'local' });
    window.location.href = "index.html";
});

const btnSuppression = document.getElementById("btn-suppression");
const suppressionMessage = document.getElementById("suppression-message");

btnSuppression.addEventListener('click', async () => {
    if (!window.confirm("Supprimer définitivement votre compte ? Cette action est irréversible.")) {
        return;
    }

    setMessage(suppressionMessage, "", null);
    setLoading(btnSuppression, true, "Suppression en cours…");

    const { error } = await supabase.functions.invoke("delete-accounts", { method: "POST" });

    if (error) {
        setMessage(suppressionMessage, `La suppression a échoué : ${error}`, "error");
        setLoading(btnSuppression, false);
        return;
    }

    await supabase.auth.signOut({ scope: 'local' });
    window.location.href = "index.html";
});
