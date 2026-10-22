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

let conversations = [];
let currentChannelId = null;
let abonnementMessages = null;
const messagesAffiches = new Set();
const pseudos = new Map();

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
    }
});

function markdownEnHtml(texte) {
    const html = marked.parse(texte, { gfm: true, breaks: true });
    return DOMPurify.sanitize(html, { FORBID_TAGS: ["img"] });
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
    contenu.innerHTML = markdownEnHtml(message.content ?? "");

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

async function envoyerMessage(e) {
    e.preventDefault();

    const content = champMessage.value.trim();
    setMessage(messageFormMessage, "", null);

    if (!currentChannelId) {
        setMessage(messageFormMessage, "Choisissez d'abord une conversation.", "error");
        return;
    }

    if (!content) {
        setMessage(messageFormMessage, "Le message est vide.", "error");
        champMessage.focus();
        return;
    }

    setLoading(boutonMessage, true, "Envoi…");

    try {
        const { data: message, error } = await supabase
            .from("messages")
            .insert({ channel_id: currentChannelId, content })
            .select("id, channel_id, user_id, content, created_at")
            .single();

        if (error) {
            setMessage(messageFormMessage, `L'envoi a échoué : ${error.message}`, "error");
            return;
        }

        champMessage.value = "";
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
    // Entrée envoie, Maj + Entrée va à la ligne (isComposing : ne pas couper une saisie IME en cours)
    champMessage.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            // bouton désactivé = envoi déjà en cours, évite un double envoi
            if (!boutonMessage.disabled) formMessage.requestSubmit();
        }
    });
    await loadConversations();
}