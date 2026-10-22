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

let conversations = [];
let currentChannelId = null;

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

function selectConversation(channelId) {
    const channel = conversations.find((c) => c.id === channelId);
    if (!channel) return;

    currentChannelId = channel.id;
    conversationName.textContent = channel.name;
    renderConversations();

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
    await loadConversations();
}