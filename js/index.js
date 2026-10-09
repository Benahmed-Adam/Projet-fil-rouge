import { supabase, isSessionActive } from './supabaseClient.js';
import { setMessage, setLoading } from './ui.js';

if (await isSessionActive()) {
    window.location.href = "conversation.html";
}

const URL_CONVERSATION = new URL("conversation.html", window.location.href).href;
const URL_REINITIALISATION = new URL("reset-password.html", window.location.href).href;

document.getElementById("form-connexion").addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById("email-connexion").value.trim();
    const password = document.getElementById("password-connexion").value;
    const message = document.getElementById("connexion-message");
    const bouton = document.getElementById("btn-connexion");

    setMessage(message, "", null);
    setLoading(bouton, true, "Connexion en cours…");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        setMessage(message, error, "error");
        setLoading(bouton, false);
        return;
    }

    window.location.href = "conversation.html";
});

document.getElementById("form-inscription").addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById("email-inscription").value.trim();
    const password = document.getElementById("password-inscription").value;
    const passwordConfirm = document.getElementById("password-inscription-confirm").value;
    const message = document.getElementById("inscription-message");
    const bouton = document.getElementById("btn-inscription");

    setMessage(message, "", null);

    if (password !== passwordConfirm) {
        setMessage(message, "Les deux mots de passe ne correspondent pas.", "error");
        return;
    }

    setLoading(bouton, true, "Création du compte…");

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: URL_CONVERSATION },
    });

    setLoading(bouton, false);

    if (error) {
        setMessage(message, error, "error");
        return;
    }

    if (data.session) {
        setMessage(message, "Compte créé, vous êtes connecté.", "success");
        window.location.href = "conversation.html";
        return;
    }

    setMessage(message, `Compte créé ! Un email de confirmation vous a été envoyé à ${email}.`, "success");
});

const formRecuperation = document.getElementById("form-recuperation");

formRecuperation.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById("email-recuperation").value.trim();
    const message = document.getElementById("recuperation-message");
    const bouton = document.getElementById("btn-recuperation");

    setMessage(message, "", null);
    setLoading(bouton, true, "Envoi en cours…");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: URL_REINITIALISATION,
    });

    setLoading(bouton, false);

    if (error) {
        setMessage(message, error, "error");
        return;
    }

    setMessage(message, `Un email de réinitialisation a été envoyé à ${email}.`, "success");
});
