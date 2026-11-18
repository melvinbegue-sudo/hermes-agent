# Mettre en ligne le serveur MB NUTRITION (Supabase)

Comptez environ 30 minutes. Tant que vous n'avez pas fini, l'appli continue de marcher en mode local, sans rien perdre.

Ce que le serveur apporte : connexion des clients par code reçu par e-mail, synchronisation des journées, poids,
mensurations et photos, espace coach avec tous vos clients, chat, et analyse des photos de repas par l'IA.

## 1. Créer le projet (gratuit)

1. Allez sur https://supabase.com, puis « Start your project ». Connectez-vous (avec GitHub ou un e-mail).
2. « New project » : nom `mb-nutrition`, choisissez un mot de passe de base de données (gardez-le en lieu sûr),
   région **West EU (Paris)** ou **Central EU (Frankfurt)**, offre **Free**.
3. Attendez environ 2 minutes que le projet soit prêt.

## 2. Créer les tables (copier-coller)

1. Menu de gauche : **SQL Editor**, puis « New query ».
2. Ouvrez le fichier `supabase/migrations/0001_init.sql`, copiez **tout** le contenu, collez-le, cliquez sur **Run**.
3. Le message « Success. No rows returned » doit s'afficher. Ne le lancez qu'une fois.

## 3. Recevoir un code à 6 chiffres par e-mail

L'appli demande un code, pas un lien (un lien ouvrirait le navigateur au lieu de l'appli).

1. **Authentication > Emails > Templates > Magic Link** : remplacez le contenu par exemple par :
   `Votre code MB NUTRITION : <h2>{{ .Token }}</h2> Il est valable 1 heure.`
   Faites de même dans le modèle **Confirm signup**. Enregistrez.
2. **Authentication > Sign In / Providers > Email** : vérifiez que « Email OTP Length » vaut **6**.
3. **Authentication > Sign In / Providers** : désactivez **Allow new users to sign up**. Seuls les clients que vous
   invitez peuvent se connecter (personne ne peut créer de compte tout seul et consommer votre budget IA).
   Pour ajouter un client : **Authentication > Users > Add user > Send invitation**, avec son e-mail.
   Il ouvre ensuite l'appli, tape son e-mail et reçoit son code.
4. L'envoi d'e-mails inclus dans l'offre gratuite est limité à quelques e-mails par heure. Avant d'inviter
   tous vos clients, branchez votre propre service d'e-mail (**Authentication > Emails > SMTP Settings**, par exemple Brevo, gratuit).

## 4. Brancher l'appli

1. **Project Settings > API** (ou « Data API ») : copiez **Project URL** et la clé **anon public**.
2. Ouvrez `www/config.js` et collez-les entre les guillemets :
   ```js
   window.MB_CONFIG = { supabaseUrl: "https://xxxx.supabase.co", supabaseAnonKey: "eyJ..." };
   ```
   La clé « anon » peut être publique : ce sont les règles d'accès de l'étape 2 qui protègent les données.
   Ne collez **jamais** la clé `service_role` dans l'appli.

## 5. Devenir le coach (Melvin)

1. Invitez-vous vous-même (**Authentication > Users > Add user**), puis connectez-vous une première fois dans l'appli avec votre e-mail (vous recevez un code).
2. Dans **SQL Editor**, lancez ces deux lignes en mettant votre e-mail :
   ```sql
   update profiles set role = 'coach' where email = 'votre.email@exemple.fr';
   update profiles set coach_id = (select id from profiles where role = 'coach') where role = 'client';
   ```
   La deuxième ligne rattache à vous les clients déjà inscrits. Les suivants vous seront rattachés automatiquement.

## 6. Analyse des photos de repas par l'IA

1. Créez une clé API sur https://console.anthropic.com (**API Keys**). Ajoutez un moyen de paiement et,
   par prudence, une limite de dépense mensuelle (**Limits**). Chaque client est limité à 30 analyses par jour.
2. Supabase : **Edge Functions > Secrets** : ajoutez `ANTHROPIC_API_KEY` avec la clé, puis enregistrez.
3. **Edge Functions > Deploy a new function > Via Editor** : nommez-la exactement `analyze-meal`,
   remplacez le code par le contenu de `supabase/functions/analyze-meal/index.ts`, puis cliquez sur **Deploy**.
   (Si un développeur vous aide, il peut aussi taper `npx supabase functions deploy analyze-meal`.)

## Vérifier

- Sur un téléphone, connectez-vous comme client, ajoutez un repas : une ligne apparaît dans **Table Editor > days**.
- Avec votre compte coach, le client apparaît dans l'espace coach.
- Un client ne voit jamais les données d'un autre client : c'est imposé par la base, pas par l'appli.

## En cas de souci

- « Code invalide » : le code expire au bout d'une heure, et seul le dernier code reçu est valable.
- Pas d'e-mail reçu : regardez les spams, puis la limite d'envoi de l'étape 3.
- Analyse photo indisponible : vérifiez le secret `ANTHROPIC_API_KEY` et les journaux dans **Edge Functions > analyze-meal > Logs**.
