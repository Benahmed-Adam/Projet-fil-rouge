# Messagerie de qualité

Projet Fil-Rouge du cours 8WEB101 : une messagerie instantanée web pour échanger des messages en temps réel dans des salons de conversation.

**Url du site :** https://benahmed-adam.github.io/Projet-fil-rouge/

## Présentation

Après avoir créé un compte, l'utilisateur peut créer des salons publics ou privés, rejoindre les salons publics, inviter ses contacts dans ses salons et discuter en temps réel. Les messages s'affichent avec leur auteur et leur heure d'envoi. Ils acceptent le Markdown et le HTML et peuvent contenir des images.

## Fonctionnalités principales

### Inscription et connexion

- **Inscription** : l'utilisateur choisit un pseudo (3 à 30 caractères : lettres sans accent, chiffres ou `_`), un email et un mot de passe de 6 caractères minimum, à confirmer. Le pseudo est unique, sans tenir compte des majuscules : si `adam` existe, `ADAM` est refusé. Un trigger de la base crée le profil en même temps que le compte, donc une inscription refusée ne laisse aucun compte.
- **Connexion** : avec l'email et le mot de passe. Un utilisateur déjà connecté arrive directement sur ses conversations, et un visiteur non connecté qui ouvre une page privée revient à la page de connexion.
- **Mot de passe oublié** : un email contient un lien vers une page où choisir un nouveau mot de passe. Un lien invalide ou expiré est signalé et le formulaire reste désactivé.

### Liste de contacts

Depuis la page " Contacts " :

- **Ajouter un contact** : on envoie une demande à partir d'un pseudo, sans tenir compte des majuscules.
- **Demandes reçues** : on peut les accepter ou les refuser.
- **Demandes envoyées** : on peut les annuler tant qu'elles n'ont pas reçu de réponse.
- **Mes contacts** : la liste des contacts acceptés, avec un bouton pour retirer un contact après confirmation.

Une seule demande peut exister entre deux personnes, quel que soit celui qui l'a envoyée. Les listes se mettent à jour au retour sur l'onglet.

### Liste des salons

- **Créer un salon** : avec un nom de 100 caractères maximum, public ou privé. Son créateur en devient le propriétaire.
- **Rejoindre un salon public** : la page " Contacts " liste les salons publics dont on n'est pas encore membre.
- **Inviter dans un salon** : tout membre peut inviter un de ses contacts avec le bouton " Inviter ". La base refuse d'inviter quelqu'un qui n'est pas un contact accepté ou qui est déjà membre. L'invitation expire au bout de 7 jours.
- **Répondre à une invitation** : la page " Contacts " permet d'accepter ou de refuser les invitations reçues, et d'annuler celles qu'on a envoyées.
- **Quitter un salon** : possible pour un membre. Un salon privé demande ensuite une nouvelle invitation pour y revenir.
- **Supprimer un salon** : réservé au propriétaire, après confirmation. Les messages et les invitations du salon sont supprimés, et le salon disparaît en direct chez les membres qui ont la page ouverte.

### Envoi et réception des messages en temps réel

- **Lecture** : un salon n'est lisible que par ses membres. À l'ouverture, ses 100 derniers messages s'affichent.
- **Envoi** : les messages sont limités à 2000 caractères. Sur le clavier, Entrée envoie et Maj + Entrée va à la ligne.
- **Réception** : les nouveaux messages arrivent sans recharger la page, grâce au temps réel de Supabase.
- **Disposition** : ses propres messages sont à droite, teintés et signés " Vous ". Ceux des autres sont à gauche, avec leur pseudo.
- **Défilement** : la liste suit les nouveaux messages, sauf si on est remonté lire d'anciens messages. Envoyer un message ramène en bas.
- **Mise en forme** : le Markdown est pris en charge (gras, listes, citations, code, tableaux, liens), ainsi que le HTML et le CSS en ligne. Les liens s'ouvrent dans un nouvel onglet.
- **Sécurité** : DOMPurify retire tout ce qui peut exécuter du JavaScript. Les balises `<style>` et `<form>` sont aussi retirées, et le CSS d'un message ne peut pas sortir de sa bulle.

### Affichage horodaté des messages

Chaque message affiche son auteur, son heure et sa date, par exemple " à 14:05 le 07/11/2026 ".

## Fonctionnalités secondaires

### Notification à la réception d'un message

Quand un message arrive dans un autre salon que celui qui est ouvert :

- un **son** est joué, si l'utilisateur a déjà cliqué sur la page, car les navigateurs bloquent le son avant cela ;
- un **badge rouge** indique le nombre de messages non lus à côté du salon. Il disparaît à l'ouverture du salon et repart de zéro au rechargement de la page.

### Partage d'images

- **Envoyer une image** : PNG, JPEG, GIF ou WebP, 5 Mo maximum, avec un aperçu et la possibilité de la retirer avant l'envoi. Un texte peut l'accompagner.
- **Stockage** : les images sont dans un bucket privé Supabase, dans un dossier propre à chaque salon. Seuls les membres du salon peuvent les voir, grâce à des liens temporaires valables 1 heure.
- **Images externes** : un message peut aussi afficher une image venant d'un autre site avec la syntaxe Markdown `![texte](https://…)`.

## Fonctionnalité supplémentaire : personnaliser le salon

Le propriétaire d'un salon peut modifier depuis le bouton " Paramètres du salon " :

- **Le nom du salon**.
- **Trois couleurs** : l'accent (boutons et bordures), le fond et le texte de la zone de discussion. Le bouton " Couleurs par défaut " les réinitialise.
- **L'image de fond**, avec les mêmes formats et la même taille maximale que les images des messages. Elle peut être remplacée ou retirée.

Le changement s'applique en direct chez tous les membres qui ont le salon ouvert, sans recharger la page. La base n'accepte que ces réglages : une couleur doit être au format `#rrggbb`, et l'image de fond doit être rangée dans le dossier du salon.

## Autres fonctionnalités

- **Paramètres du compte** : changer de pseudo, se déconnecter et supprimer définitivement son compte. La suppression passe par une edge function Supabase, car seule une clé gardée côté serveur peut supprimer un compte.
- **Écran adapté** : sur téléphone et tablette, les blocs s'empilent et seuls les messages défilent. La liste des salons tient sur une ligne qui défile horizontalement, et le formulaire de création est replié.
- **Sécurité des données** : les règles Row Level Security de la base vérifient chaque lecture et chaque écriture. Le site lui-même ne décide donc pas de ce qu'un utilisateur a le droit de faire.

## Technologies

- HTML, CSS et JavaScript, sans framework
- [Supabase](https://supabase.com) : comptes, base de données PostgreSQL, temps réel et stockage des images
- [marked](https://marked.js.org) pour le Markdown et [DOMPurify](https://github.com/cure53/DOMPurify) pour bloquer le JavaScript dans les messages
- GitHub Pages pour la mise en ligne

## Équipe

- Adam Benahmed

Projet réalisé seul.
