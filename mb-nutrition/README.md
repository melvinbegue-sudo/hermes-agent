# MB NUTRITION — application iPhone et Android

L'application est le site du dossier `www/`, emballé avec **Capacitor**.
Dans l'app, elle lit **Apple Santé** (iPhone) et **Health Connect** (Android) :
pas, fréquence cardiaque de la journée, FC au repos, VFC, sommeil, calories actives, poids.
Elle sait aussi scanner un code-barres, envoyer des rappels (repas, séances) et recevoir les
notifications push envoyées par le coach.

## Ce qu'il vous faut

| | iPhone | Android |
|---|---|---|
| Ordinateur | **un Mac** avec Xcode (gratuit, App Store) | Mac ou PC avec Android Studio (gratuit) |
| Compte | Apple Developer — **99 €/an** (developer.apple.com) | Google Play Console — **25 €** une fois (play.google.com/console) |
| Outils | Node.js 22+, CocoaPods (`brew install cocoapods`) | Node.js 22+ |

## Commandes (dans le dossier `mb-nutrition`)

```bash
npm install          # une fois, puis après chaque mise à jour du projet
npx cap sync         # à relancer après CHAQUE modification de www/
npx cap open ios     # ouvre le projet dans Xcode (Mac seulement)
npx cap open android # ouvre le projet dans Android Studio
npm test             # petite vérification automatique des modules santé / scanner
```

## iPhone (Xcode)

1. `npx cap sync` puis `npx cap open ios` (la première fois, `cd ios/App && pod install` si Xcode
   se plaint des « Pods »).
2. Dans Xcode : cliquez sur **App** (à gauche) → onglet **Signing & Capabilities** →
   **Team** : choisissez votre compte Apple Developer.
3. Vérifiez que **HealthKit** apparaît dans la liste. Sinon : **+ Capability** → **HealthKit**.
   (Le fichier `App.entitlements` et les textes d'autorisation en français sont déjà prêts.)
4. Branchez votre iPhone, sélectionnez-le en haut, bouton ▶ pour tester.
5. **TestFlight** (pour faire tester vos clients) : menu **Product → Archive** →
   **Distribute App → App Store Connect → Upload**. Puis sur appstoreconnect.apple.com :
   créez l'app (identifiant `fr.mbnutrition.app`), onglet **TestFlight**, ajoutez les testeurs
   par e-mail.
6. Pour la publication, Apple demande une **politique de confidentialité** (URL) qui explique
   l'usage des données Santé.

## Android (Android Studio)

1. `npx cap sync` puis `npx cap open android`, attendez la fin de « Gradle sync ».
2. Remplacez l'URL de votre politique de confidentialité dans
   `android/app/src/main/res/values/strings.xml` (`health_connect_privacy_policy_url`) —
   Health Connect l'affiche aux utilisateurs.
3. Sur le téléphone : Android 14+ a Health Connect intégré ; Android 9–13 doit installer
   **Health Connect** depuis le Play Store. L'app demande ensuite les autorisations.
4. Test : branchez le téléphone (mode développeur activé) → bouton ▶.
5. Publication : **Build → Generate Signed App Bundle** → envoyez le `.aab` dans la Play Console
   (piste « Test interne » d'abord). Google demande de remplir le **formulaire Health Connect**
   (pourquoi l'app lit chaque donnée) et la section **Sécurité des données**.
6. Le scanner de code-barres télécharge un petit module Google au premier usage : si le premier
   scan ne s'ouvre pas, réessayez après quelques secondes.

## Notifications push (Firebase)

Les push passent par **Firebase Cloud Messaging** (gratuit) sur iPhone **et** Android, via le
plugin `@capacitor-firebase/messaging` : il donne le même type de jeton (FCM) sur les deux, et
le serveur (fonction Supabase `send-push`) n'a qu'une seule façon d'envoyer. Sans les fichiers
Firebase ci-dessous, l'app fonctionne normalement, simplement sans push.

1. Sur **console.firebase.google.com** : créez un projet « MB NUTRITION » (Analytics inutile).
2. **Ajouter une app iOS**, identifiant `fr.mbnutrition.app` → téléchargez
   `GoogleService-Info.plist`. Dans Xcode, glissez-le dans le dossier **App/App** (à côté
   d'`Info.plist`), cochez **Copy items if needed** et la cible **App**. (Le copier seulement
   dans le dossier ne suffit pas : Xcode doit l'ajouter au projet.)
3. **Ajouter une app Android**, nom de package `fr.mbnutrition.app` → téléchargez
   `google-services.json` dans `android/app/`. Rien d'autre à faire : le projet active le plugin
   Google Services seulement si ce fichier existe.
4. **Clé APNs** (obligatoire pour iPhone) : developer.apple.com → **Certificates, Identifiers &
   Profiles → Keys → +** → cochez **Apple Push Notifications service (APNs)** → téléchargez le
   fichier `.p8` (une seule fois possible !) et notez le **Key ID** et votre **Team ID**. Puis
   Firebase → ⚙️ **Paramètres du projet → Cloud Messaging → App iOS → Clé d'authentification
   APNs → Importer**.
5. Dans Xcode, **Signing & Capabilities** : vérifiez **Push Notifications** et **Background
   Modes** (case **Remote notifications** cochée) ; sinon **+ Capability** pour les ajouter.
   Les fichiers `App.entitlements` et `Info.plist` sont déjà prêts.
6. **Avant TestFlight / App Store** : dans `ios/App/App/App.entitlements`, remplacez
   `development` par `production` pour `aps-environment`.
7. Côté serveur : Firebase → **Paramètres du projet → Comptes de service → Générer une nouvelle
   clé privée** → le fichier JSON va dans le secret Supabase `FCM_SERVICE_ACCOUNT`
   (jamais dans l'app ni dans git).
8. Test : les push ne marchent **pas dans le simulateur iPhone** ; utilisez un vrai téléphone.

Android : l'icône des push est l'icône de l'app ; Android l'affiche en carré blanc. Pour une
jolie icône, ajoutez une icône blanche sur fond transparent `res/drawable/ic_stat_notify` et
décommentez la ligne prévue dans `AndroidManifest.xml`. Les push arrivent dans la catégorie
« Divers » des réglages de notification, ce qui suffit pour commencer.

`GoogleService-Info.plist` et `google-services.json` ne sont pas des mots de passe, mais ils
sont propres à votre projet Firebase : ne les copiez pas d'un autre projet.

## Widget iPhone « Anneaux du jour »

Widget d'écran d'accueil (petit et moyen) : trois anneaux calories / protéines / pas, valeurs et
objectifs du jour ; « — » tant que l'app n'a pas été ouverte aujourd'hui. Un toucher ouvre l'app.
La cible **MBWidget** est **déjà dans le projet Xcode** (dossier `ios/App/MBWidget/`), et l'app
lui envoie les chiffres via le petit plugin `App/MBWidgetPlugin.swift`.

Les deux cibles partagent un **App Group** `group.fr.mbnutrition.app` (les fichiers
`.entitlements` le déclarent déjà). Dans Xcode, une fois :

1. `cd ios/App && pod install` puis `npx cap open ios`.
2. Cible **App** → **Signing & Capabilities** → **Team**. Si **App Groups** n'apparaît pas :
   **+ Capability → App Groups**, puis cochez `group.fr.mbnutrition.app` (le **+** sous la liste
   le crée chez Apple s'il n'existe pas).
3. Cible **MBWidget** → même chose : **Team** (le même), **App Groups** coché
   `group.fr.mbnutrition.app`. Identifiant : `fr.mbnutrition.app.MBWidget`.
4. ▶ sur l'iPhone, ouvrez l'app une fois, puis appui long sur l'écran d'accueil → **+** →
   **MB NUTRITION** → « Anneaux du jour ».

Si Xcode refuse la cible (message sur « MBWidget ») : supprimez-la (cible **MBWidget** → touche
⌫), puis **File → New → Target → Widget Extension**, nom `MBWidget`, décochez « Include Live
Activity » et « Include Configuration App Intent », **Activate**. Remplacez les fichiers créés par
ceux de `ios/App/MBWidget/` (garder `MBWidget.swift`, `Info.plist`, `MBWidget.entitlements`,
supprimer les autres `.swift` générés), mettez **Minimum Deployments** à iOS 15.0 et refaites
l'étape 3.

## Partage de fichiers (PDF)

Dans l'app, « Exporter en PDF » ouvre la **feuille de partage** iPhone / Android (Enregistrer dans
Fichiers, Mail, WhatsApp…) via `@capacitor/filesystem` et `@capacitor/share`. Rien à régler.
Dans un navigateur, le fichier est simplement téléchargé.

## Cycle menstruel

Le plugin santé utilisé (`@capgo/capacitor-health`, dernière version 8.13) **ne lit pas encore le
flux menstruel** d'Apple Santé ni de Health Connect. Le suivi du cycle se fait donc par **saisie
manuelle** dans l'app ; aucune autorisation santé supplémentaire n'est demandée. Quand le plugin
l'ajoutera, il faudra : l'autorisation `READ_MENSTRUATION` (Android), une phrase sur le cycle dans
le texte d'autorisation Santé (iPhone) et le formulaire Health Connect à mettre à jour.

## Paiement de l'abonnement et règles Apple / Google

L'abonnement (87 €/mois) se paie **dans l'app** avec Stripe : carte, **Apple Pay** (iPhone) ou
**Google Pay** (Android), sans quitter l'app. Si ce paiement n'est pas disponible (navigateur,
aperçu, configuration incomplète), l'app ouvre la page de paiement Stripe à la place.
Réglages (clé publique, Apple Pay, Google Pay) : `supabase/README.md`, étape 8.

Apple impose normalement son propre paiement (règle **3.1.1**, avec commission) pour tout
contenu numérique débloqué dans l'app. Exception **3.1.3(d) « services de personne à
personne »** : un coaching individuel en temps réel entre deux personnes (comme un coach
sportif ou un nutritionniste) peut être payé autrement. Le cœur de l'offre (suivi et appels avec
Melvin) entre dans ce cas ; le relecteur Apple peut toutefois juger que le plan ou le chat sont
du « contenu numérique ».

- Dans l'app, restez **factuel** : « Votre abonnement n'est pas actif », bouton « Gérer mon
  abonnement ». Évitez « moins cher sur le site », les comparaisons de prix ou les incitations à
  payer ailleurs.
- Dans les notes pour le relecteur (App Store Connect), expliquez qu'il s'agit d'un coaching
  nutritionnel individuel avec appels en direct, et fournissez un compte de test abonné.
- Payer avec Stripe **dans** l'app n'est permis que si l'exception 3.1.3(d) s'applique. Sinon Apple
  exige son achat intégré (In-App Purchase). Google Play a la même logique (Play Billing obligatoire
  pour le contenu numérique, exception pour les services réels / individuels).
  **À faire confirmer par Apple et Google avant la soumission.**
- **Melvin : vérifiez les règles Apple en vigueur pour la France / l'UE avant la soumission**
  (elles ont changé plusieurs fois avec le DMA européen). Google Play a des règles proches
  (paiements pour services hors app).

## Bon à savoir

- Les données santé sont **informatives**, pas médicales.
- Sur iPhone, Apple ne dit jamais à l'app si l'utilisateur a refusé l'accès : des valeurs
  vides = accès refusé ou pas de données. Réglages → Santé → Accès aux données → MB NUTRITION.
- Dans un navigateur (ou l'aperçu claude.ai), les fonctions santé sont simplement absentes.
- Fichiers techniques : `capacitor.config.json`, `www/health.js` (santé), `www/native.js`
  (scanner, rappels, push, liens, partage, widget), dossiers `ios/` et `android/`.
