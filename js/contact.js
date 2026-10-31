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

const formAjoutContact = document.getElementById("form-ajout-contact");
const champAjoutContact = document.getElementById("ajout-contact-pseudo");
const btnAjoutContact = document.getElementById("btn-ajout-contact");
const messageAjoutContact = document.getElementById("ajout-contact-message");

const listeContacts = document.getElementById("mes-contacts");
const videContacts = document.getElementById("mes-contacts-vide");
const messageContacts = document.getElementById("mes-contacts-message");

const listeDemandesRecues = document.getElementById("demandes-recues");
const videDemandesRecues = document.getElementById("demandes-recues-vide");
const messageDemandesRecues = document.getElementById("demandes-recues-message");

const listeDemandesEnvoyees = document.getElementById("demandes-envoyees");
const videDemandesEnvoyees = document.getElementById("demandes-envoyees-vide");
const messageDemandesEnvoyees = document.getElementById("demandes-envoyees-message");

const PSEUDO_REGEX = /^[A-Za-z0-9_]{3,30}$/;

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

async function chargerContacts() {
    const { data, error } = await supabase
        .from("contacts")
        .select("requester_id, addressee_id, status, demandeur:profiles!contacts_requester_id_fkey(username), destinataire:profiles!contacts_addressee_id_fkey(username)")
        .order("created_at", { ascending: false });

    if (error) {
        setMessage(messageContacts, `Impossible de charger les contacts : ${error.message}`, "error");
        return;
    }

    const contacts = [];
    const recues = [];
    const envoyees = [];

    for (const ligne of data) {
        const jeSuisDemandeur = ligne.requester_id === user.id;
        const autre = (jeSuisDemandeur ? ligne.destinataire : ligne.demandeur)?.username ?? "Inconnu";
        const autreId = jeSuisDemandeur ? ligne.addressee_id : ligne.requester_id;

        let li;
        if (ligne.status === "accepted") {
            li = creerElement(autreId, [["Contact", autre]], [["retirer-contact", "Retirer"]]);
            contacts.push(li);
        } else if (jeSuisDemandeur) {
            li = creerElement(autreId, [["Pour", autre]], [["annuler-contact", "Annuler la demande"]]);
            envoyees.push(li);
        } else {
            li = creerElement(autreId, [["De", autre]], [["accepter-contact", "Accepter"], ["refuser-contact", "Refuser"]]);
            recues.push(li);
        }

        li.dataset.requester = ligne.requester_id;
        li.dataset.addressee = ligne.addressee_id;
        li.dataset.pseudo = autre;
    }

    afficherListe(listeContacts, videContacts, contacts);
    afficherListe(listeDemandesRecues, videDemandesRecues, recues);
    afficherListe(listeDemandesEnvoyees, videDemandesEnvoyees, envoyees);
}

async function envoyerDemandeContact(e) {
    e.preventDefault();

    const pseudo = champAjoutContact.value.trim();
    setMessage(messageAjoutContact, "", null);

    if (!PSEUDO_REGEX.test(pseudo)) {
        setMessage(messageAjoutContact, "Pseudo invalide : 3 à 30 caractères, lettres sans accent, chiffres ou _.", "error");
        return;
    }

    setLoading(btnAjoutContact, true, "Envoi…");

    try {
        const { data: profil, error: erreurProfil } = await supabase
            .from("profiles")
            .select("id, username")
            .ilike("username", pseudo.replaceAll("_", "\\_"))
            .maybeSingle();

        if (erreurProfil) {
            setMessage(messageAjoutContact, `La recherche a échoué : ${erreurProfil.message}`, "error");
            return;
        }

        if (!profil) {
            setMessage(messageAjoutContact, `Aucun utilisateur ne s'appelle « ${pseudo} ».`, "error");
            return;
        }

        if (profil.id === user.id) {
            setMessage(messageAjoutContact, "Vous ne pouvez pas vous ajouter vous-même.", "error");
            return;
        }

        const { error } = await supabase.from("contacts").insert({ addressee_id: profil.id });

        if (error) {
            setMessage(messageAjoutContact, `La demande a échoué : ${error.message}`, "error");
            return;
        }

        champAjoutContact.value = "";
        setMessage(messageAjoutContact, `Demande envoyée à ${profil.username}.`, "success");
        await chargerContacts();
    } finally {
        setLoading(btnAjoutContact, false);
    }
}

function filtreContact(requete, li) {
    return requete.eq("requester_id", li.dataset.requester).eq("addressee_id", li.dataset.addressee);
}

async function accepterContact(li, bouton) {
    setMessage(messageDemandesRecues, "", null);
    setLoading(bouton, true, "…");

    const { error } = await filtreContact(supabase.from("contacts").update({ status: "accepted" }), li);

    if (error) {
        setLoading(bouton, false);
        setMessage(messageDemandesRecues, `Impossible d'accepter : ${error.message}`, "error");
        return;
    }

    setMessage(messageDemandesRecues, `${li.dataset.pseudo} fait maintenant partie de vos contacts.`, "success");
    await chargerContacts();
}

async function supprimerContact(li, bouton, liste, vide, message, texteReussite) {
    setMessage(message, "", null);
    setLoading(bouton, true, "…");

    const { error } = await filtreContact(supabase.from("contacts").delete(), li);

    if (error) {
        setLoading(bouton, false);
        setMessage(message, `L'opération a échoué : ${error.message}`, "error");
        return;
    }

    retirerElement(li, liste, vide);
    setMessage(message, texteReussite, "success");
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
        case "accepter-contact":
            accepterContact(li, bouton);
            break;
        case "refuser-contact":
            supprimerContact(li, bouton, listeDemandesRecues, videDemandesRecues, messageDemandesRecues, "Demande refusée.");
            break;
        case "annuler-contact":
            supprimerContact(li, bouton, listeDemandesEnvoyees, videDemandesEnvoyees, messageDemandesEnvoyees, "Demande annulée.");
            break;
        case "retirer-contact":
            if (window.confirm(`Retirer ${li.dataset.pseudo} de vos contacts ?`)) {
                supprimerContact(li, bouton, listeContacts, videContacts, messageContacts, `${li.dataset.pseudo} ne fait plus partie de vos contacts.`);
            }
            break;
    }
}

if (!(await isSessionActive()) || !user) {
    window.location.replace("index.html");
} else {
    const listes = [listeSalonsPublics, listeRecues, listeEnvoyees, listeContacts, listeDemandesRecues, listeDemandesEnvoyees];
    for (const liste of listes) {
        liste.addEventListener("click", onClicListe);
    }
    formAjoutContact.addEventListener("submit", envoyerDemandeContact);
    await Promise.all([chargerContacts(), chargerSalonsPublics(), chargerInvitationsRecues(), chargerInvitationsEnvoyees()]);
}
