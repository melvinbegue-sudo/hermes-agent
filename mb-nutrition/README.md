# MB NUTRITION — application iPhone et Android

L'application est le site du dossier `www/`, emballé avec **Capacitor**.
Dans l'app, elle lit **Apple Santé** (iPhone) et **Health Connect** (Android) :
pas, fréquence cardiaque de la journée, FC au repos, VFC, sommeil, calories actives, poids.
Elle sait aussi scanner un code-barres et envoyer des rappels.

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

## Bon à savoir

- Les données santé sont **informatives**, pas médicales.
- Sur iPhone, Apple ne dit jamais à l'app si l'utilisateur a refusé l'accès : des valeurs
  vides = accès refusé ou pas de données. Réglages → Santé → Accès aux données → MB NUTRITION.
- Dans un navigateur (ou l'aperçu claude.ai), les fonctions santé sont simplement absentes.
- Fichiers techniques : `capacitor.config.json`, `www/health.js` (santé), `www/native.js`
  (scanner, rappels), dossiers `ios/` et `android/`.
