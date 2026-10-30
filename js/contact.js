import { supabase, isSessionActive, user } from './supabaseClient.js';
import { setMessage, setLoading } from './ui.js';

const listeSalonsPublics = document.getElementById("salons-publics");
const videSalonsPublics = document.getElementById("salons-publics-vide");
const messageSalonsPublics = document.getElementById("salons-publics-message");

const listeRecues = document.getElementById("invitations-recues");
const videRecues = document.getElementById("invitations-recues-vide");
const messageRecues = document.getElementById("invitations-recues-message");

const listeEnvoyees = document.getElementById("invitations-envoyees");
const videEnvoyees = document.getElementById("invitations-envoyees-vide");
const messageEnvoyees = document.getElementById("invitations-envoyees-message");

function messageAvecLien(element, texte, salonId) {
    setMessage(element, `${texte} `, "success");
    const lien = document.createElement("a");
    lien.href = `conversation.html?salon=${encodeURIComponent(salonId)}`;
    lien.textContent = "Ouvrir la conversation";
    element.append(lien);
}

function creerElement(id, lignes, boutons) {
    const li = document.createElement("li");
    li.dataset.id = id;
    const article = document.createElement("article");

    for (const [libelle, valeur] of lignes) {
        const p = document.createElement("p");
        const strong = document.createElement("strong");
        strong.textContent = valeur;
        p.append(`${libelle} : `, strong);
        article.append(p);
    }

    for (const [action, texte] of boutons) {
        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.dataset.action = action;
        bouton.textContent = texte;
        article.append(bouton);
    }

    li.append(article);
    return li;
}

function retirerElement(li, liste, vide) {
    li.remove();
    vide.hidden = liste.children.length > 0;
}

function afficherListe(liste, vide, elements) {
    liste.replaceChildren(...elements);
    vide.hidden = elements.length > 0;
}


async function chargerSalonsPublics() {
    const { data: membres, error: erreurMembres } = await supabase
        .from("channel_members")
        .select("channel_id")
        .eq("user_id", user.id);

    const { data: salons, error } = await supabase
        .from("channels")
        .select("id, name")
        .eq("is_public", true)
        .order("created_at", { ascending: false });

    if (erreurMembres || error) {
        setMessage(messageSalonsPublics, `Impossible de charger les salons : ${(erreurMembres ?? error).message}`, "error");
        return;
    }

    const dejaMembre = new Set(membres.map((m) => m.channel_id));
    const elements = salons
        .filter((salon) => !dejaMembre.has(salon.id))
        .map((salon) => creerElement(salon.id, [["Salon", salon.name]], [["rejoindre", "Rejoindre"]]));

    afficherListe(listeSalonsPublics, videSalonsPublics, elements);
}

async function rejoindreSalon(li, bouton) {
    setMessage(messageSalonsPublics, "", null);
    setLoading(bouton, true, "…");

    const { error } = await supabase.from("channel_members").insert({ channel_id: li.dataset.id });

    if (error) {
        setLoading(bouton, false);
        setMessage(messageSalonsPublics, `Impossible de rejoindre le salon : ${error.message}`, "error");
        return;
    }

    retirerElement(li, listeSalonsPublics, videSalonsPublics);
    messageAvecLien(messageSalonsPublics, "Vous avez rejoint le salon.", li.dataset.id);
}

async function chargerInvitationsRecues() {
    const { data, error } = await supabase
        .from("channel_invitations")
        .select("id, channel_id, channels(name), inviteur:profiles!channel_invitations_inviter_id_fkey(username)")
        .eq("invitee_id", user.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

    if (error) {
        setMessage(messageRecues, `Impossible de charger les invitations : ${error.message}`, "error");
        return;
    }

    const elements = data.map((invitation) => {
        const li = creerElement(
            invitation.id,
            [["Par", invitation.inviteur?.username ?? "Inconnu"], ["Salon", invitation.channels?.name ?? "Inconnu"]],
            [["accepter", "Accepter"], ["refuser", "Refuser"]]
        );
        li.dataset.salon = invitation.channel_id;
        return li;
    });

    afficherListe(listeRecues, videRecues, elements);
}

async function accepterInvitation(li, bouton) {
    setMessage(messageRecues, "", null);
    setLoading(bouton, true, "…");

    const { error } = await supabase.rpc("accepter_invitation", { invitation_id: li.dataset.id });

    if (error) {
        setLoading(bouton, false);
        setMessage(messageRecues, `Impossible d'accepter : ${error.message}`, "error");
        return;
    }

    retirerElement(li, listeRecues, videRecues);
    messageAvecLien(messageRecues, "Invitation acceptée.", li.dataset.salon);
}

async function changerStatut(li, bouton, status, liste, vide, message, texteReussite) {
    setMessage(message, "", null);
    setLoading(bouton, true, "…");

    const { error } = await supabase
        .from("channel_invitations")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("id", li.dataset.id);

    if (error) {
        setLoading(bouton, false);
        setMessage(message, `L'opération a échoué : ${error.message}`, "error");
        return;
    }

    retirerElement(li, liste, vide);
    setMessage(message, texteReussite, "success");
}

async function chargerInvitationsEnvoyees() {
    const { data, error } = await supabase
        .from("channel_invitations")
        .select("id, channels(name), invite:profiles!channel_invitations_invitee_id_fkey(username)")
        .eq("inviter_id", user.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

    if (error) {
        setMessage(messageEnvoyees, `Impossible de charger les invitations : ${error.message}`, "error");
        return;
    }

    const elements = data.map((invitation) => creerElement(
        invitation.id,
        [["Pour", invitation.invite?.username ?? "Inconnu"], ["Salon", invitation.channels?.name ?? "Inconnu"]],
        [["annuler", "Annuler l'invitation"]]
    ));

    afficherListe(listeEnvoyees, videEnvoyees, elements);
}

function onClicListe(e) {
    const bouton = e.target.closest("button[data-action]");
    if (!bouton) return;
    const li = bouton.closest("li");

    switch (bouton.dataset.action) {
        case "rejoindre":
            rejoindreSalon(li, bouton);
            break;
        case "accepter":
            accepterInvitation(li, bouton);
            break;
        case "refuser":
            changerStatut(li, bouton, "declined", listeRecues, videRecues, messageRecues, "Invitation refusée.");
            break;
        case "annuler":
            changerStatut(li, bouton, "revoked", listeEnvoyees, videEnvoyees, messageEnvoyees, "Invitation annulée.");
            break;
    }
}

if (!(await isSessionActive()) || !user) {
    window.location.replace("index.html");
} else {
    for (const liste of [listeSalonsPublics, listeRecues, listeEnvoyees]) {
        liste.addEventListener("click", onClicListe);
    }
    await Promise.all([chargerSalonsPublics(), chargerInvitationsRecues(), chargerInvitationsEnvoyees()]);
}
