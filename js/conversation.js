import { supabase, isSessionActive, user } from './supabaseClient.js';
import { setMessage, setLoading } from './ui.js';

const NOM_MAX_LENGTH = 100;

const conversationName = document.getElementById("conversation-name");
const messagesList = document.getElementById("messages-list");
const conversationsList = document.getElementById("conversations-list");

const formNouvelleConversation = document.getElementById("form-nouvelle-conversation");
const champNouvelleConversation = document.getElementById("nouvelle_conversation_nom");
const champSalonPublic = document.getElementById("salon-public");
const boutonNouvelleConversation = document.getElementById("nouvelle_conversation");
const messageNouvelleConversation = document.getElementById("nouvelle-conversation-message");

const formMessage = document.getElementById("form-nouveau-message");
const champMessage = document.getElementById("nouveau-message");
const boutonMessage = document.getElementById("btn-envoyer-message");
const messageFormMessage = document.getElementById("message-form-message");
const champImage = document.getElementById("image-message");
const boutonRetirerImage = document.getElementById("btn-retirer-image");
const apercuImage = document.getElementById("apercu-image");
const apercuImageVisuel = document.getElementById("apercu-image-visuel");
const apercuImageNom = document.getElementById("apercu-image-nom");

const sectionMessages = messagesList.closest("section");
const btnParametresSalon = document.getElementById("btn-parametres-salon");
const dialogSalon = document.getElementById("dialog-salon");
const formSalon = document.getElementById("form-salon");
const champSalonNom = document.getElementById("salon-nom");
const champsCouleurs = {
    couleur_accent: document.getElementById("salon-couleur-accent"),
    couleur_fond: document.getElementById("salon-couleur-fond"),
    couleur_texte: document.getElementById("salon-couleur-texte"),
};
const btnCouleursDefaut = document.getElementById("btn-couleurs-defaut");
const champFond = document.getElementById("salon-image-fond");
const apercuFond = document.getElementById("salon-apercu-fond");
const btnRetirerFond = document.getElementById("btn-retirer-fond");
const btnAnnulerSalon = document.getElementById("btn-annuler-salon");
const btnEnregistrerSalon = document.getElementById("btn-enregistrer-salon");
const salonMessage = document.getElementById("salon-message");

const btnInviter = document.getElementById("btn-inviter");
const dialogInviter = document.getElementById("dialog-inviter");
const formInviter = document.getElementById("form-inviter");
const champInviterPseudo = document.getElementById("inviter-pseudo");
const btnEnvoyerInvitation = document.getElementById("btn-envoyer-invitation");
const btnFermerInviter = document.getElementById("btn-fermer-inviter");
const inviterMessage = document.getElementById("inviter-message");
const PSEUDO_REGEX = /^[A-Za-z0-9_]{3,30}$/;

const btnQuitterSalon = document.getElementById("btn-quitter-salon");
const btnSupprimerSalon = document.getElementById("btn-supprimer-salon");

const MESSAGES_LIMITE = 100;

const COULEURS_DEFAUT = { couleur_accent: "#202020", couleur_fond: "#ffffff", couleur_texte: "#171717" };
const COULEUR_REGEX = /^#[0-9a-fA-F]{6}$/;
const VARIABLES_COULEURS = { couleur_accent: "--salon-accent", couleur_fond: "--salon-fond", couleur_texte: "--salon-texte" };

const EXTENSIONS_IMAGE = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
const CHEMIN_IMAGE_REGEX = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|gif|webp)$/;

const urlsSignees = new Map();
let urlApercu = null;
let urlApercuFond = null;
let fondRetire = false;

let conversations = [];
let currentChannelId = null;
let abonnementMessages = null;
const messagesAffiches = new Set();
const pseudos = new Map();

async function urlSignee(chemin) {
    if (!urlsSignees.has(chemin)) {
        const { data, error } = await supabase.storage.from("message-images").createSignedUrl(chemin, 3600);
        if (error) return null;
        urlsSignees.set(chemin, data.signedUrl);
    }
    return urlsSignees.get(chemin);
}

async function afficherImages(contenu) {
    for (const img of contenu.querySelectorAll("img[data-chemin]")) {
        const url = await urlSignee(img.dataset.chemin);
        if (url) {
            img.src = url;
        } else {
            img.replaceWith("[image indisponible]");
        }
    }
}

function markdownEnHtml(texte) {
    const html = marked.parse(texte, { gfm: true, breaks: true });
    return DOMPurify.sanitize(html, { FORBID_TAGS: ["style", "form"] });
}

function construireContenu(texte) {
    const doc = new DOMParser().parseFromString(markdownEnHtml(texte), "text/html");

    for (const img of doc.querySelectorAll("img")) {
        const src = img.getAttribute("src") ?? "";
        if (CHEMIN_IMAGE_REGEX.test(src)) {
            img.dataset.chemin = src;
            img.removeAttribute("src");
        }
    }

    return [...doc.body.childNodes];
}

function renderConversations() {
    conversationsList.replaceChildren();

    for (const channel of conversations) {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = channel.name;
        link.dataset.channelId = channel.id;
        if (channel.id === currentChannelId) {
            link.setAttribute("aria-current", "true");
        }
        li.append(link);
        conversationsList.append(li);
    }
}

function formaterDate(iso) {
    const date = new Date(iso);
    const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return `à ${heure} le ${date.toLocaleDateString("fr-FR")}`;
}

function afficherMessage(message) {
    if (messagesAffiches.has(message.id)) return;
    messagesAffiches.add(message.id);

    const li = document.createElement("li");
    if (message.user_id === user.id) {
        li.className = "message-envoye";
    }
    const article = document.createElement("article");
    article.className = "message";

    const header = document.createElement("header");
    const auteur = document.createElement("h2");
    auteur.textContent = `Envoyé par : ${pseudos.get(message.user_id) ?? "Inconnu"}`;
    const p = document.createElement("p");
    const time = document.createElement("time");
    time.dateTime = message.created_at;
    time.textContent = formaterDate(message.created_at);
    p.append(time);
    header.append(auteur, p);

    const contenu = document.createElement("div");
    contenu.className = "contenu-message";
    contenu.append(...construireContenu(message.content ?? ""));
    for (const img of contenu.querySelectorAll("img")) {
        img.addEventListener("load", () => {
            messagesList.scrollTop = messagesList.scrollHeight;
        });
    }
    afficherImages(contenu);

    article.append(header, contenu);
    li.append(article);
    messagesList.append(li);
    messagesList.scrollTop = messagesList.scrollHeight;
}

async function chargerPseudo(userId) {
    if (pseudos.has(userId)) return;

    const { data } = await supabase.from("profiles").select("username").eq("id", userId).single();
    pseudos.set(userId, data?.username ?? "Inconnu");
}

async function loadMessages(channelId) {
    messagesList.replaceChildren();
    messagesAffiches.clear();

    const { data, error } = await supabase
        .from("messages")
        .select("id, user_id, content, created_at, profiles(username)")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(MESSAGES_LIMITE);

    if (channelId !== currentChannelId) return;

    if (error) {
        setMessage(messageFormMessage, `Impossible de charger les messages : ${error.message}`, "error");
        return;
    }

    for (const message of data.reverse()) {
        pseudos.set(message.user_id, message.profiles?.username ?? "Inconnu");
        afficherMessage(message);
    }
}

async function appliquerStyle(channel) {
    const style = channel.style ?? {};

    for (const [cle, variable] of Object.entries(VARIABLES_COULEURS)) {
        if (COULEUR_REGEX.test(style[cle] ?? "")) {
            sectionMessages.style.setProperty(variable, style[cle]);
        } else {
            sectionMessages.style.removeProperty(variable);
        }
    }

    sectionMessages.style.removeProperty("--salon-image");
    if (CHEMIN_IMAGE_REGEX.test(style.image_fond ?? "")) {
        const url = await urlSignee(style.image_fond);
        if (url && channel.id === currentChannelId) {
            sectionMessages.style.setProperty("--salon-image", `url("${url.replaceAll('"', "%22")}")`);
        }
    }
}

function mettreAJourSalon(salon) {
    const channel = conversations.find((c) => c.id === salon.id);
    if (!channel) return;

    channel.name = salon.name;
    channel.style = salon.style;
    renderConversations();

    if (channel.id === currentChannelId) {
        conversationName.textContent = channel.name;
        appliquerStyle(channel);
    }
}

function ecouterMessages(channelId) {
    if (abonnementMessages) {
        supabase.removeChannel(abonnementMessages);
    }

    abonnementMessages = supabase
        .channel(`messages:${channelId}`)
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
            async ({ new: message }) => {
                await chargerPseudo(message.user_id);
                if (message.channel_id === currentChannelId) {
                    afficherMessage(message);
                }
            }
        )
        .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "channels", filter: `id=eq.${channelId}` },
            ({ new: salon }) => mettreAJourSalon(salon)
        )
        .subscribe();
}

async function selectConversation(channelId) {
    const channel = conversations.find((c) => c.id === channelId);
    if (!channel) return;

    currentChannelId = channel.id;
    conversationName.textContent = channel.name;
    btnParametresSalon.hidden = !["owner", "admin"].includes(channel.role);
    btnInviter.hidden = false;
    btnQuitterSalon.hidden = channel.role === "owner";
    btnSupprimerSalon.hidden = channel.role !== "owner";
    setMessage(messageFormMessage, "", null);
    renderConversations();
    appliquerStyle(channel);

    ecouterMessages(channel.id);
    await loadMessages(channel.id);
}

function viderConversation() {
    currentChannelId = null;
    if (abonnementMessages) {
        supabase.removeChannel(abonnementMessages);
        abonnementMessages = null;
    }
    messagesList.replaceChildren();
    messagesAffiches.clear();
    conversationName.textContent = "";

    renderConversations();
    appliquerStyle({});
}

async function retirerConversation(channelId) {
    conversations = conversations.filter((c) => c.id !== channelId);

    if (channelId !== currentChannelId) {
        renderConversations();
    } else if (conversations.length > 0) {
        await selectConversation(conversations[0].id);
    } else {
        viderConversation();
    }
}

async function quitterSalon() {
    const channel = conversations.find((c) => c.id === currentChannelId);
    if (!channel) return;

    const confirmation = channel.is_public
        ? `Quitter le salon " ${channel.name} " ?`
        : `Quitter le salon privé " ${channel.name} " ? Il faudra une nouvelle invitation pour y revenir.`;
    if (!window.confirm(confirmation)) return;

    setMessage(messageFormMessage, "", null);
    setLoading(btnQuitterSalon, true, "Départ…");

    const { data, error } = await supabase
        .from("channel_members")
        .delete()
        .eq("channel_id", channel.id)
        .eq("user_id", user.id)
        .select("channel_id");

    setLoading(btnQuitterSalon, false);

    if (error || data.length === 0) {
        setMessage(messageFormMessage, `Impossible de quitter le salon : ${error?.message}`, "error");
        return;
    }

    await retirerConversation(channel.id);
    setMessage(messageFormMessage, `Vous avez quitté le salon " ${channel.name} ".`, "success");
}

async function supprimerSalon() {
    const channel = conversations.find((c) => c.id === currentChannelId);
    if (!channel) return;

    if (!window.confirm(`Supprimer définitivement le salon " ${channel.name} " et tous ses messages, pour tous ses membres ?`)) return;

    setMessage(messageFormMessage, "", null);
    setLoading(btnSupprimerSalon, true, "Suppression…");

    const { data, error } = await supabase
        .from("channels")
        .delete()
        .eq("id", channel.id)
        .select("id");

    setLoading(btnSupprimerSalon, false);

    if (error || data.length === 0) {
        setMessage(messageFormMessage, `Impossible de supprimer le salon : ${error?.message}`, "error");
        return;
    }

    await retirerConversation(channel.id);
    setMessage(messageFormMessage, `Le salon " ${channel.name} " a été supprimé.`, "success");
}

function afficherApercuFond(url) {
    apercuFond.src = url ?? "";
    apercuFond.hidden = !url;
    btnRetirerFond.hidden = !url;
}

function libererApercuFond() {
    if (urlApercuFond) URL.revokeObjectURL(urlApercuFond);
    urlApercuFond = null;
}

async function ouvrirParametresSalon() {
    const channel = conversations.find((c) => c.id === currentChannelId);
    if (!channel) return;

    const style = channel.style ?? {};
    champSalonNom.value = channel.name;
    for (const [cle, champ] of Object.entries(champsCouleurs)) {
        champ.value = COULEUR_REGEX.test(style[cle] ?? "") ? style[cle] : COULEURS_DEFAUT[cle];
    }

    champFond.value = "";
    fondRetire = false;
    libererApercuFond();
    afficherApercuFond(null);
    setMessage(salonMessage, "", null);
    dialogSalon.showModal();

    if (CHEMIN_IMAGE_REGEX.test(style.image_fond ?? "")) {
        afficherApercuFond(await urlSignee(style.image_fond));
    }
}

function onFondChoisi() {
    const fichier = champFond.files[0];
    setMessage(salonMessage, "", null);
    if (!fichier) return;

    const erreur = verifierImage(fichier);
    if (erreur) {
        champFond.value = "";
        setMessage(salonMessage, erreur, "error");
        return;
    }

    libererApercuFond();
    urlApercuFond = URL.createObjectURL(fichier);
    afficherApercuFond(urlApercuFond);
}

function retirerFond() {
    champFond.value = "";
    fondRetire = true;
    libererApercuFond();
    afficherApercuFond(null);
}

function couleursParDefaut() {
    for (const [cle, champ] of Object.entries(champsCouleurs)) {
        champ.value = COULEURS_DEFAUT[cle];
    }
}

async function enregistrerSalon(e) {
    e.preventDefault();

    const channel = conversations.find((c) => c.id === currentChannelId);
    if (!channel) return;

    const name = champSalonNom.value.trim();
    setMessage(salonMessage, "", null);

    if (!name || name.length > NOM_MAX_LENGTH) {
        setMessage(salonMessage, `Le nom doit faire entre 1 et ${NOM_MAX_LENGTH} caractères.`, "error");
        champSalonNom.focus();
        return;
    }

    const style = {};
    for (const [cle, champ] of Object.entries(champsCouleurs)) {
        const couleur = champ.value.toLowerCase();
        if (couleur !== COULEURS_DEFAUT[cle]) style[cle] = couleur;
    }

    const ancienFond = channel.style?.image_fond ?? null;
    if (ancienFond && !fondRetire) style.image_fond = ancienFond;

    const fichier = champFond.files[0];
    const erreurImage = fichier ? verifierImage(fichier) : null;
    if (erreurImage) {
        setMessage(salonMessage, erreurImage, "error");
        return;
    }

    setLoading(btnEnregistrerSalon, true, "Enregistrement…");

    try {
        let nouveauFond = null;

        if (fichier) {
            nouveauFond = `${channel.id}/${crypto.randomUUID()}.${EXTENSIONS_IMAGE[fichier.type]}`;
            const { error: erreurEnvoi } = await supabase.storage
                .from("message-images")
                .upload(nouveauFond, fichier, { contentType: fichier.type });

            if (erreurEnvoi) {
                setMessage(salonMessage, `L'envoi de l'image a échoué : ${erreurEnvoi.message}`, "error");
                return;
            }
            style.image_fond = nouveauFond;
        }

        const { data: salon, error } = await supabase
            .from("channels")
            .update({ name, style })
            .eq("id", channel.id)
            .select("id, name, style")
            .single();

        if (error) {
            if (nouveauFond) await supabase.storage.from("message-images").remove([nouveauFond]);
            setMessage(salonMessage, `La modification a échoué : ${error.message}`, "error");
            return;
        }

        if (ancienFond && ancienFond !== salon.style.image_fond) {
            supabase.storage.from("message-images").remove([ancienFond]);
        }

        mettreAJourSalon(salon);
        dialogSalon.close();
    } finally {
        setLoading(btnEnregistrerSalon, false);
    }
}

function verifierImage(fichier) {
    if (!EXTENSIONS_IMAGE[fichier.type]) return "Format non accepté : PNG, JPEG, GIF ou WebP uniquement.";
    if (fichier.size > (5 * 1024 * 1024)) return "L'image dépasse 5 Mo.";
    return null;
}

function retirerImage() {
    champImage.value = "";
    if (urlApercu) URL.revokeObjectURL(urlApercu);
    urlApercu = null;
    apercuImageVisuel.src = "";
    apercuImageNom.textContent = "";
    apercuImage.hidden = true;
    boutonRetirerImage.hidden = true;
}

function onImageChoisie() {
    const fichier = champImage.files[0];
    setMessage(messageFormMessage, "", null);
    if (!fichier) {
        retirerImage();
        return;
    }

    const erreur = verifierImage(fichier);
    if (erreur) {
        retirerImage();
        setMessage(messageFormMessage, erreur, "error");
        return;
    }

    if (urlApercu) URL.revokeObjectURL(urlApercu);
    urlApercu = URL.createObjectURL(fichier);
    apercuImageVisuel.src = urlApercu;
    apercuImageNom.textContent = fichier.name;
    apercuImage.hidden = false;
    boutonRetirerImage.hidden = false;
}

async function envoyerMessage(e) {
    e.preventDefault();

    const texte = champMessage.value.trim();
    const fichier = champImage.files[0];
    setMessage(messageFormMessage, "", null);

    if (!currentChannelId) {
        setMessage(messageFormMessage, "Choisissez d'abord une conversation.", "error");
        return;
    }

    if (!texte && !fichier) {
        setMessage(messageFormMessage, "Le message est vide.", "error");
        champMessage.focus();
        return;
    }

    const erreurImage = fichier ? verifierImage(fichier) : null;
    if (erreurImage) {
        setMessage(messageFormMessage, erreurImage, "error");
        return;
    }

    setLoading(boutonMessage, true, "Envoi…");

    try {
        let content = texte;
        let chemin = null;

        if (fichier) {
            chemin = `${currentChannelId}/${crypto.randomUUID()}.${EXTENSIONS_IMAGE[fichier.type]}`;
            const { error: erreurEnvoi } = await supabase.storage
                .from("message-images")
                .upload(chemin, fichier, { contentType: fichier.type });

            if (erreurEnvoi) {
                setMessage(messageFormMessage, `L'envoi de l'image a échoué : ${erreurEnvoi.message}`, "error");
                return;
            }

            content = `${texte}${texte ? "\n\n" : ""}![image](${chemin})`;
        }

        const { data: message, error } = await supabase
            .from("messages")
            .insert({ channel_id: currentChannelId, content })
            .select("id, channel_id, user_id, content, created_at")
            .single();

        if (error) {
            if (chemin) await supabase.storage.from("message-images").remove([chemin]);
            setMessage(messageFormMessage, `L'envoi a échoué : ${error.message}`, "error");
            return;
        }

        champMessage.value = "";
        retirerImage();
        await chargerPseudo(message.user_id);
        if (message.channel_id === currentChannelId) {
            afficherMessage(message);
        }
    } finally {
        setLoading(boutonMessage, false);
        champMessage.focus();
    }
}

function ouvrirInviter() {
    formInviter.reset();
    setMessage(inviterMessage, "", null);
    dialogInviter.showModal();
}

async function envoyerInvitation(e) {
    e.preventDefault();

    const pseudo = champInviterPseudo.value.trim();
    setMessage(inviterMessage, "", null);

    if (!PSEUDO_REGEX.test(pseudo)) {
        setMessage(inviterMessage, "Pseudo invalide : 3 à 30 caractères, lettres sans accent, chiffres ou _.", "error");
        return;
    }

    setLoading(btnEnvoyerInvitation, true, "Envoi…");

    try {
        const { data: profil, error: erreurProfil } = await supabase
            .from("profiles")
            .select("id, username")
            .ilike("username", pseudo.replaceAll("_", "\\_"))
            .maybeSingle();

        if (erreurProfil) {
            setMessage(inviterMessage, `La recherche a échoué : ${erreurProfil.message}`, "error");
            return;
        }

        if (!profil) {
            setMessage(inviterMessage, `Aucun utilisateur ne s'appelle " ${pseudo} ".`, "error");
            return;
        }

        if (profil.id === user.id) {
            setMessage(inviterMessage, "Vous ne pouvez pas vous inviter vous-même.", "error");
            return;
        }

        const { data: contact } = await supabase
            .from("contacts")
            .select("status")
            .eq("status", "accepted")
            .or(`requester_id.eq.${profil.id},addressee_id.eq.${profil.id}`)
            .maybeSingle();

        if (!contact) {
            setMessage(inviterMessage, `${profil.username} n'est pas dans vos contacts. Envoyez-lui d'abord une demande depuis la page Contacts.`, "error");
            return;
        }

        const { data: membre } = await supabase
            .from("channel_members")
            .select("user_id")
            .eq("channel_id", currentChannelId)
            .eq("user_id", profil.id)
            .maybeSingle();

        if (membre) {
            setMessage(inviterMessage, `${profil.username} est déjà membre du salon.`, "error");
            return;
        }

        const { error } = await supabase
            .from("channel_invitations")
            .insert({ channel_id: currentChannelId, invitee_id: profil.id });

        if (error) {
            setMessage(inviterMessage, `L'invitation a échoué : ${error.message}`, "error");
            return;
        }

        champInviterPseudo.value = "";
        setMessage(inviterMessage, `Invitation envoyée à ${profil.username}. Elle apparaîtra dans sa page Contacts.`, "success");
    } finally {
        setLoading(btnEnvoyerInvitation, false);
    }
}

async function loadConversations() {
    const { data, error } = await supabase
        .from("channels")
        .select("*, channel_members!inner(user_id, role)")
        .eq("channel_members.user_id", user.id)
        .order("created_at", { ascending: true });

    if (error) {
        setMessage(messageNouvelleConversation, `Impossible de charger les conversations : ${error.message}`, "error");
        return;
    }

    conversations = data.map(({ channel_members, ...channel }) => ({ ...channel, role: channel_members[0]?.role }));
    renderConversations();

    const salonDemande = new URLSearchParams(window.location.search).get("salon");
    const salonAOuvrir = conversations.find((c) => c.id === salonDemande) ?? conversations[0];
    if (salonAOuvrir) {
        await selectConversation(salonAOuvrir.id);
    }
}

async function creerConversation(e) {
    e.preventDefault();

    const name = champNouvelleConversation.value.trim();
    const isPublic = champSalonPublic.checked;
    setMessage(messageNouvelleConversation, "", null);

    if (!name) {
        setMessage(messageNouvelleConversation, "Le nom de la conversation est obligatoire.", "error");
        champNouvelleConversation.focus();
        return;
    }

    if (name.length > NOM_MAX_LENGTH) {
        setMessage(messageNouvelleConversation, `Le nom ne peut pas dépasser ${NOM_MAX_LENGTH} caractères.`, "error");
        champNouvelleConversation.focus();
        return;
    }

    setLoading(boutonNouvelleConversation, true, "Création…");

    try {
        const { data: channel, error } = await supabase
            .from("channels")
            .insert({ name, is_public: isPublic })
            .select()
            .single();

        if (error) {
            setMessage(messageNouvelleConversation, `La création a échoué : ${error.message}`, "error");
            return;
        }

        formNouvelleConversation.reset();
        setMessage(messageNouvelleConversation, `La conversation " ${name} " a été créée.`, "success");

        conversations.push({ ...channel, role: "owner" });
        selectConversation(channel.id);
    } finally {
        setLoading(boutonNouvelleConversation, false);
    }
}

function onConversationClick(e) {
    const link = e.target.closest("a[data-channel-id]");
    if (!link) return;

    e.preventDefault();
    selectConversation(link.dataset.channelId);
}

if (!(await isSessionActive()) || !user) {
    window.location.replace("index.html");
} else {
    formNouvelleConversation.addEventListener("submit", creerConversation);
    conversationsList.addEventListener("click", onConversationClick);
    formMessage.addEventListener("submit", envoyerMessage);
    champImage.addEventListener("change", onImageChoisie);
    boutonRetirerImage.addEventListener("click", retirerImage);
    btnParametresSalon.addEventListener("click", ouvrirParametresSalon);
    btnInviter.addEventListener("click", ouvrirInviter);
    btnQuitterSalon.addEventListener("click", quitterSalon);
    btnSupprimerSalon.addEventListener("click", supprimerSalon);
    formInviter.addEventListener("submit", envoyerInvitation);
    btnFermerInviter.addEventListener("click", () => dialogInviter.close());
    formSalon.addEventListener("submit", enregistrerSalon);
    champFond.addEventListener("change", onFondChoisi);
    btnRetirerFond.addEventListener("click", retirerFond);
    btnCouleursDefaut.addEventListener("click", couleursParDefaut);
    btnAnnulerSalon.addEventListener("click", () => dialogSalon.close());
    dialogSalon.addEventListener("close", libererApercuFond);
    champMessage.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            if (!boutonMessage.disabled) formMessage.requestSubmit();
        }
    });
    await loadConversations();
}