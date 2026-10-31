# Messagerie de qualité

Projet Fil-Rouge du cours 8WEB101 : une messagerie instantanée web pour échanger des messages en temps réel dans des salons de conversation.

**Url du site :** https://benahmed-adam.github.io/Projet-fil-rouge/

## Présentation

Après avoir créé un compte, l'utilisateur peut créer des salons publics ou privés, rejoindre les salons publics, inviter d'autres personnes dans ses salons et discuter en temps réel. Les messages s'affichent avec leur auteur et leur heure d'envoi. Ils acceptent le Markdown et le HTML et peuvent contenir des images.

### Fonctionnalités

- Inscription, connexion, réinitialisation du mot de passe, changement de pseudo et suppression du compte
- Liste des salons : création, salons publics à rejoindre, invitations dans les salons privés
- Liste de contacts : demandes de contact envoyées et reçues, acceptation, retrait
- Envoi et réception des messages en temps réel, avec date et heure
- Envoi d'images
- Messages sur plusieurs lignes, mis en forme en Markdown

### Fonctionnalité supplémentaire : personnaliser le salon

Le propriétaire d'un salon peut modifier son nom, ses couleurs (accent, fond, texte) et son image de fond depuis le bouton « Paramètres du salon ». Le changement s'applique en direct chez tous les membres.

## Technologies

- HTML, CSS et JavaScript, sans framework
- [Supabase](https://supabase.com) : comptes, base de données PostgreSQL, temps réel et stockage des images
- [marked](https://marked.js.org) pour le Markdown et [DOMPurify](https://github.com/cure53/DOMPurify) pour bloquer le JavaScript dans les messages
- GitHub Pages pour la mise en ligne

## Équipe

- Adam Benahmed
