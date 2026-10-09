export function setMessage(element, texte, type) {
    if (!element) return;

    element.textContent = texte;
    element.classList.remove("message--error", "message--success");

    if (type === "error" || type === "success") {
        element.classList.add(`message--${type}`);
    }
}

export function setLoading(bouton, actif, libelleAttente = "Veuillez patienter…") {
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
