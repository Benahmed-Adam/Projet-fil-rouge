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

const MESSAGES_LIMITE = 100;

const EXTENSIONS_IMAGE = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
const CHEMIN_IMAGE_REGEX = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|gif|webp)$/;

const urlsSignees = new Map();
let urlApercu = null;

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
        .subscribe();
}

async function selectConversation(channelId) {
    const channel = conversations.find((c) => c.id === channelId);
    if (!channel) return;

    currentChannelId = channel.id;
    conversationName.textContent = channel.name;
    setMessage(messageFormMessage, "", null);
    renderConversations();

    ecouterMessages(channel.id);
    await loadMessages(channel.id);
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

async function loadConversations() {
    const { data, error } = await supabase
        .from("channels")
        .select("*, channel_members!inner(user_id)")
        .eq("channel_members.user_id", user.id)
        .order("created_at", { ascending: true });

    if (error) {
        setMessage(messageNouvelleConversation, `Impossible de charger les conversations : ${error.message}`, "error");
        return;
    }

    conversations = data.map(({ channel_members, ...channel }) => channel);
    renderConversations();

    if (conversations.length > 0) {
        await selectConversation(conversations[0].id);
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
        setMessage(messageNouvelleConversation, `La conversation « ${name} » a été créée.`, "success");

        conversations.push(channel);
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
    champMessage.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            if (!boutonMessage.disabled) formMessage.requestSubmit();
        }
    });
    await loadConversations();
}