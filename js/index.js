import { supabase, isSessionActive } from './supabaseClient.js';

if ((await isSessionActive())) {
    window.location.href= "conversation.html";
}

document.getElementById("btn-connexion").addEventListener('click', async (e) => {
    e.preventDefault();

    const email = document.getElementById("email-connexion").value;
    const password = document.getElementById("password-connexion").value;
    const connexionError = document.getElementById("connexion-error");

    connexionError.textContent = "";

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        connexionError.textContent = error.message;
        return;
    }

    console.log("Connecté :", data);
    window.location.href = "conversation.html";
});

document.getElementById("btn-inscription").addEventListener('click', async (e) => {
    e.preventDefault();

    const email = document.getElementById("email-inscription").value;
    const password = document.getElementById("password-inscription").value;
    const passwordConfirm = document.getElementById("password-inscription-confirm").value;
    const inscriptionError = document.getElementById("inscription-error");

    inscriptionError.textContent = "";

    if (password !== passwordConfirm) {
        inscriptionError.textContent = "Les deux mots de passe ne correspondent pas !";
        return;
    }

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        inscriptionError.textContent = error.message;
        return;
    }

    console.log("Compte créé :", data);
    inscriptionError.textContent = `Compte créé ! Un email de confirmation vous a été envoyé à l'adresse : ${email}`;
});

document.getElementById("btn-recuperation").addEventListener('click', async (e) => {
    e.preventDefault();

    const email = document.getElementById("email-recuperation").value;
    const recuperationError = document.getElementById("recuperation-error");

    recuperationError.textContent = "";

    if (!email) {
        recuperationError.textContent = "Veuillez entrer votre adresse email.";
        return;
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
        recuperationError.textContent = error.message;
        return;
    }

    recuperationError.textContent = `Un e-mail de réinitialisation a été envoyé à : ${email}`;
});