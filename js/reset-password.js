import { supabase, isSessionActive } from "./supabaseClient.js";
import { setMessage, setLoading } from "./ui.js";

const form = document.getElementById("form-reset");
const message = document.getElementById("reset-message");
const bouton = document.getElementById("btn-reset");

// Le formulaire reste désactivé tant que le lien reçu par email n'est pas validé
bouton.disabled = true;

let lienValide = false;

function activerFormulaire() {
  lienValide = true;
  bouton.disabled = false;
  setMessage(message, "", null);
}

// Supabase lit le jeton du lien dans l'adresse et ouvre une session : c'est ce qui prouve que le lien est valide
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY" || (session && !lienValide)) {
    activerFormulaire();
  }
});

// La session a pu s'ouvrir avant que l'écouteur ci-dessus soit en place
if (await isSessionActive()) {
  activerFormulaire();
}

// Toujours aucune session après 1.5 secondes : le lien est invalide ou expiré
setTimeout(() => {
  if (!lienValide) {
    setMessage(
      message,
      "Ce lien de réinitialisation est invalide ou a expiré. Demandez un nouveau email depuis la page de connexion.",
      "error",
    );
  }
}, 1500);

// Enregistre le nouveau mot de passe
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const password = document.getElementById("password-reset").value;
  const passwordConfirm = document.getElementById(
    "password-reset-confirm",
  ).value;

  setMessage(message, "", null);

  if (password !== passwordConfirm) {
    setMessage(
      message,
      "Les deux mots de passe ne correspondent pas.",
      "error",
    );
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
