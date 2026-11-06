// Affiche un texte dans une zone de message, en vert (success) ou en rouge (error)
export function setMessage(element, texte, type) {
  if (!element) return;

  element.textContent = texte;
  element.classList.remove("message--error", "message--success");

  if (type === "error" || type === "success") {
    element.classList.add(`message--${type}`);
  }
}

// Désactive un bouton pendant une opération avec un texte d'attente, puis lui rend son libellé
export function setLoading(
  bouton,
  actif,
  libelleAttente = "Veuillez patienter…",
) {
  if (!bouton) return;

  if (actif) {
    bouton.dataset.libelle = bouton.textContent;
    bouton.textContent = libelleAttente;
    bouton.disabled = true;
  } else {
    if (bouton.dataset.libelle) {
      bouton.textContent = bouton.dataset.libelle;
    }
    bouton.disabled = false;
  }
}
