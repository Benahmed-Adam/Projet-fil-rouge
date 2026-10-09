import { supabase, isSessionActive } from './supabaseClient.js';
import { setMessage, setLoading } from './ui.js';

const form = document.getElementById("form-reset");
const message = document.getElementById("reset-message");
const bouton = document.getElementById("btn-reset");

bouton.disabled = true;

let lienValide = false;

function activerFormulaire() {
    lienValide = true;
    bouton.disabled = false;
    setMessage(message, "", null);
}

supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" || (session && !lienValide)) {
        activerFormulaire();
    }
});

if (await isSessionActive()) {
    activerFormulaire();
}

setTimeout(() => {
    if (!lienValide) {
        setMessage(
            message,
            "Ce lien de réinitialisation est invalide ou a expiré. Demandez un nouvel email depuis la page de connexion.",
            "error"
        );
    }
}, 1500);

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = document.getElementById("password-reset").value;
    const passwordConfirm = document.getElementById("password-reset-confirm").value;

    setMessage(message, "", null);

    if (password !== passwordConfirm) {
        setMessage(message, "Les deux mots de passe ne correspondent pas.", "error");
        return;
    }

    setLoading(bouton, true, "Enregistrement…");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
        setMessage(message, error, "error");
        setLoading(bouton, false);
        return;
    }

    setMessage(message, "Mot de passe mis à jour ! Redirection…", "success");
    setTimeout(() => {
        window.location.href = "conversation.html";
    }, 500);
});
