# Mettre en ligne le serveur MB NUTRITION (Supabase)

Comptez environ 30 minutes pour les étapes 1 à 6, puis 1 heure pour l'abonnement, les calls et les notifications (7 à 10), et 30 minutes pour le RGPD (11). Tant que vous n'avez pas fini, l'appli continue de marcher en mode local, sans rien perdre.

Ce que le serveur apporte : connexion des clients par code reçu par e-mail, synchronisation des journées, poids,
mensurations et photos, espace coach avec tous vos clients, chat, et analyse des photos de repas par l'IA.

## 1. Créer le projet (gratuit)

1. Allez sur https://supabase.com, puis « Start your project ». Connectez-vous (avec GitHub ou un e-mail).
2. « New project » : nom `mb-nutrition`, choisissez un mot de passe de base de données (gardez-le en lieu sûr),
   région **West EU (Paris)** (`eu-west-3`) ou **Central EU (Frankfurt)** (`eu-central-1`), offre **Free**.
   **Obligatoire** : les données de santé doivent rester dans l'Union européenne, et la région ne peut plus être
   changée après la création du projet.
3. Attendez environ 2 minutes que le projet soit prêt.

## 2. Créer les tables (copier-coller)

1. Menu de gauche : **SQL Editor**, puis « New query ».
2. Ouvrez le fichier `supabase/migrations/0001_init.sql`, copiez **tout** le contenu, collez-le, cliquez sur **Run**.
3. Le message « Success. No rows returned » doit s'afficher. Ne le lancez qu'une fois.
4. Nouvelle requête, même chose avec `supabase/migrations/0002_billing_calls_push.sql` (abonnement, calls, notifications).
   Une seule fois aussi, et toujours **après** le 0001.
5. Puis `supabase/migrations/0003_consent.sql` (consentement RGPD aux données de santé), une fois, après le 0002.
   À partir de là, un client qui n'a pas donné son accord dans l'appli ne peut plus envoyer ses journées, poids,
   mensurations, bilans ni photos : tout reste sur son téléphone.

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

## 7. Installer l'outil de déploiement (une fois)

Les fonctions des étapes 8 à 10 partagent des fichiers (`supabase/functions/_shared/`) : déployez-les avec la ligne
de commande, pas avec l'éditeur du site. Sur un ordinateur avec Node.js installé, dans le dossier `mb-nutrition` :

```bash
npx supabase login
npx supabase link --project-ref VOTRE_REF      # la partie « xxxx » de https://xxxx.supabase.co
```

Les « secrets » se règlent au choix dans **Edge Functions > Secrets** (site) ou avec `npx supabase secrets set NOM=valeur`.

## 8. Abonnement 87 €/mois (Stripe)

Faites tout d'abord en **mode test** (bouton « Test mode » en haut du tableau de bord Stripe), puis recommencez en mode réel.

1. Créez un compte sur https://stripe.com et complétez les infos de l'entreprise.
2. **Catalogue de produits > Ajouter un produit** : nom « Coaching MB NUTRITION », prix **87 €**, **récurrent**, **mensuel**.
   Enregistrez, puis copiez l'identifiant du prix (il commence par `price_…`).
3. **Développeurs > Clés API** : copiez la **clé secrète** (`sk_test_…` en test, `sk_live_…` en réel). Ne la mettez jamais dans l'appli.
4. **Paramètres > Facturation > Portail client** : activez le portail, autorisez « Annuler l'abonnement » et
   « Mettre à jour le moyen de paiement ». C'est la page « Gérer mon abonnement » des clients.
   **Paramètres > Billing > Revenue recovery** (Récupération des revenus) : pour « si toutes les tentatives échouent »
   (« if all retries fail »), choisissez **Annuler l'abonnement** (« cancel the subscription »). Sinon un client en
   échec de paiement (`past_due`) garderait l'accès indéfiniment.
5. Codes promo (facultatif) : **Catalogue de produits > Coupons**. Le champ code promo s'affiche au paiement.
6. Secrets Supabase :
   - `STRIPE_SECRET_KEY` = la clé secrète
   - `STRIPE_PRICE_ID` = `price_…`
   - `APP_URLS` = l'adresse où revenir après le paiement, par exemple `https://mb-nutrition.fr` (plusieurs adresses
     séparées par des virgules ; la première sert par défaut). Depuis l'appli téléphone, le client revient ensuite dans l'appli.
7. Déployez :
   ```bash
   npx supabase functions deploy create-checkout
   npx supabase functions deploy billing-portal
   npx supabase functions deploy stripe-webhook --no-verify-jwt
   ```
   `--no-verify-jwt` est obligatoire pour `stripe-webhook` : c'est Stripe qui l'appelle, pas un client connecté.
   La fonction vérifie elle-même la signature de Stripe.
8. **Développeurs > Webhooks > Ajouter une destination** :
   - URL : `https://VOTRE_REF.supabase.co/functions/v1/stripe-webhook`
   - Événements : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.payment_failed`
   - Copiez le **secret de signature** (`whsec_…`) dans le secret Supabase `STRIPE_WEBHOOK_SECRET`.
9. Test : avec un compte client, abonnez-vous avec la carte de test `4242 4242 4242 4242` (date future, n'importe quel code).
   Dans **Table Editor > subscriptions**, la ligne du client passe à `active`.

Accès offert : dans l'espace coach, « Accès offert » donne l'accès sans payer (colonne `comp`). Seul le coach du
client peut le changer, et Stripe n'y touche jamais. Paiement refusé : le client garde l'accès pendant que Stripe
retente le prélèvement (`past_due`), puis le perd si l'abonnement est annulé.

Quand un client supprime lui-même son compte dans l'appli, son abonnement Stripe est annulé automatiquement
(étape 11). **Si c'est vous qui supprimez un compte** depuis Supabase (**Authentication > Users**), annulez d'abord
son abonnement dans Stripe : sinon Stripe continue de le prélever ; le webhook ignore simplement ce client supprimé.

## 9. Calls (Cal.com)

1. Créez un compte sur https://cal.com, puis un **type d'événement** (par exemple « Call coaching », 30 min,
   lieu **Cal Video** ou Google Meet / Zoom pour avoir un lien de visio).
2. Copiez le lien public du type d'événement (par exemple `https://cal.com/melvin-begue/call`) et collez-le dans
   `www/config.js` : `calUrl: "https://cal.com/melvin-begue/call"`.
3. Choisissez un secret (une longue phrase au hasard) et mettez-le dans le secret Supabase `CAL_WEBHOOK_SECRET`.
4. Déployez : `npx supabase functions deploy cal-webhook --no-verify-jwt` (c'est Cal.com qui l'appelle).
5. Cal.com : **Paramètres > Développeur > Webhooks > Nouveau** :
   - URL : `https://VOTRE_REF.supabase.co/functions/v1/cal-webhook`
   - Secret : le même que `CAL_WEBHOOK_SECRET`
   - Événements : **Réservation créée**, **Réservation reprogrammée**, **Réservation annulée**
6. Important : le client doit réserver avec **le même e-mail que celui de son compte** dans l'appli, sinon le call
   n'est pas rattaché à lui (il reste visible pour vous dans **Table Editor > bookings**, sans client).

## 10. Notifications push (Firebase)

Les notifications envoyées par le coach passent par Firebase Cloud Messaging, pour Android et iPhone.

1. https://console.firebase.google.com > **Ajouter un projet** (Google Analytics inutile).
2. **Android** : « Ajouter une appli » > Android, nom de package `fr.mbnutrition.app`. Téléchargez
   `google-services.json` et placez-le dans `android/app/`.
3. **iPhone** : « Ajouter une appli » > iOS, bundle ID `fr.mbnutrition.app`. Téléchargez `GoogleService-Info.plist`
   et placez-le dans `ios/App/App/` (le développeur l'ajoute au projet Xcode).
   Puis sur https://developer.apple.com > **Keys** > « + », cochez **Apple Push Notifications service (APNs)**,
   téléchargez la clé `.p8` (une seule fois possible) et notez son Key ID et votre Team ID.
   Firebase > **Paramètres du projet > Cloud Messaging > Configuration des applications Apple** : envoyez la clé `.p8` avec ces deux identifiants.
4. Firebase > **Paramètres du projet > Comptes de service > Générer une nouvelle clé privée** : un fichier JSON se télécharge.
   Mettez **tout son contenu** dans le secret Supabase `FCM_SERVICE_ACCOUNT` :
   `npx supabase secrets set FCM_SERVICE_ACCOUNT="$(cat chemin/vers/le-fichier.json)"`.
   Ce fichier donne le droit d'envoyer des notifications : ne le partagez pas, ne le mettez pas dans l'appli.
5. Déployez : `npx supabase functions deploy send-push` (sans `--no-verify-jwt` : seul le coach connecté peut l'appeler).

Récapitulatif des fonctions :

| Fonction | Commande | Appelée par |
|---|---|---|
| analyze-meal | `npx supabase functions deploy analyze-meal` | l'appli |
| create-checkout | `npx supabase functions deploy create-checkout` | l'appli |
| billing-portal | `npx supabase functions deploy billing-portal` | l'appli |
| send-push | `npx supabase functions deploy send-push` | l'espace coach |
| stripe-webhook | `npx supabase functions deploy stripe-webhook --no-verify-jwt` | Stripe |
| cal-webhook | `npx supabase functions deploy cal-webhook --no-verify-jwt` | Cal.com |
| delete-account | `npx supabase functions deploy delete-account` | l'appli (client) |

## 11. RGPD : consentement, export, suppression de compte

Les pas, le cœur, le sommeil, le poids, les mensurations, le cycle et les photos sont des **données de santé**
(article 9 du RGPD) : il faut l'accord explicite du client, et pouvoir lui rendre ou effacer ses données.

1. Lancez `0003_consent.sql` si ce n'est pas fait (étape 2).
2. Déployez la suppression de compte : `npx supabase functions deploy delete-account`
   (elle utilise le secret `STRIPE_SECRET_KEY` de l'étape 8). Elle annule l'abonnement Stripe tout de suite, sans
   remboursement au prorata, efface les photos, les rendez-vous et le compte. Les factures restent chez Stripe
   (10 ans, obligation comptable). Votre compte coach ne peut pas être supprimé par ce bouton.
3. Ouvrez `www/legal.js` et remplacez `[À COMPLÉTER : adresse]` par votre adresse professionnelle
   (obligatoire dans les mentions légales).
4. Signez (ou acceptez) l'accord de sous-traitance (« DPA ») de chaque prestataire :
   - Supabase : https://supabase.com/legal/dpa (à signer depuis le tableau de bord : **Organization > Legal documents**)
   - Stripe : https://stripe.com/legal/dpa (inclus dans le contrat Stripe, rien à signer en général)
   - Cal.com : https://cal.com/legal/dpa (lien non vérifié : sinon, demandez-le à leur support)
   - Google Firebase : https://firebase.google.com/terms/data-processing-terms (à accepter dans
     **Firebase > Paramètres du projet > Confidentialité**)
   - Anthropic : https://www.anthropic.com/legal/data-processing-addendum (inclus dans les conditions commerciales de l'API)
   Gardez une copie de chacun.
5. **Faites relire `www/legal.js` par un avocat** (ou un juriste RGPD) avant le lancement. La liste des points à
   vérifier est en commentaire en haut du fichier (adresse, transferts hors UE, âge minimum, conditions de vente…).
   Vérifiez aussi avec lui s'il faut une analyse d'impact (AIPD) : la CNIL l'exige souvent pour des données de santé.
6. Changement du texte de consentement : augmentez `version` dans `www/legal.js` (par exemple `"2027-01"`),
   l'appli redemande alors l'accord.

Demande d'un client par e-mail (accès, effacement…) : vous avez **un mois** pour répondre. Le plus simple est de
lui indiquer les boutons « Exporter mes données » et « Supprimer mon compte » de l'appli.

## Vérifier

- Sur un téléphone, connectez-vous comme client, acceptez le consentement santé, ajoutez un repas : une ligne
  apparaît dans **Table Editor > days** (et une ligne dans **consents**).
- Avec votre compte coach, le client apparaît dans l'espace coach.
- Un client ne voit jamais les données d'un autre client : c'est imposé par la base, pas par l'appli.

## En cas de souci

- « Code invalide » : le code expire au bout d'une heure, et seul le dernier code reçu est valable.
- Les journées d'un client n'arrivent plus : il a refusé ou retiré le consentement santé (dernière ligne de
  **Table Editor > consents** à `false`). Ses données restent sur son téléphone tant qu'il ne l'accepte pas.
- Pas d'e-mail reçu : regardez les spams, puis la limite d'envoi de l'étape 3.
- Analyse photo indisponible : vérifiez le secret `ANTHROPIC_API_KEY` et les journaux dans **Edge Functions > analyze-meal > Logs**.
- Abonnement payé mais toujours bloqué : Stripe > **Développeurs > Webhooks** > votre destination : les envois doivent
  être en succès. En erreur 400 : le secret `STRIPE_WEBHOOK_SECRET` ne correspond pas (attention test / réel).
- Call absent de l'appli : le client a réservé avec un autre e-mail, ou le secret Cal.com diffère (journaux de `cal-webhook`).
- Notification non reçue : le client doit avoir accepté les notifications dans l'appli ; vérifiez `FCM_SERVICE_ACCOUNT`
  et, pour l'iPhone, la clé APNs dans Firebase. Les journaux sont dans **Edge Functions > send-push > Logs**.
