import { supabase, isSessionActive, user } from './supabaseClient.js';
import { setMessage, setLoading } from './ui.js';

if (!(await isSessionActive()) || !user) {
    window.location.href = "index.html";
}

const PSEUDO_REGEX = /^[A-Za-z0-9_]{3,30}$/;

const formPseudo = document.getElementById("form-pseudo");
const champPseudo = document.getElementById("pseudo");
const btnPseudo = document.getElementById("btn-pseudo");
const pseudoMessage = document.getElementById("pseudo-message");

const { data: profil } = await supabase.from("profiles").select("username").eq("id", user?.id).single();
champPseudo.value = profil?.username ?? "";

formPseudo.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = champPseudo.value.trim();
    setMessage(pseudoMessage, "", null);

    if (!PSEUDO_REGEX.test(username)) {
        setMessage(pseudoMessage, "Le pseudo doit faire 3 à 30 caractères : lettres sans accent, chiffres ou _.", "error");
        champPseudo.focus();
        return;
    }

    setLoading(btnPseudo, true, "Enregistrement…");

    const { error } = await supabase.from("profiles").update({ username }).eq("id", user.id);

    setLoading(btnPseudo, false);

    if (error) {
        setMessage(pseudoMessage, `La modification a échoué : ${error.message}`, "error");
        return;
    }

    champPseudo.value = username;
    setMessage(pseudoMessage, "Pseudo mis à jour.", "success");
});

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
