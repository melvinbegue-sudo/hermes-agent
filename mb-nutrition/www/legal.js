/* window.MB_LEGAL — mentions légales, confidentialité, texte de consentement (ARCHITECTURE.md v3).
   Static text only (no user data is ever inserted), so privacyHtml can be set as innerHTML.
   Bump `version` whenever consentText or the data uses change: the app then asks for consent again.

   TO CHECK WITH A LAWYER before going live (not shown in the UI):
   - postal address of the controller (LCEN art. 6 III) — still "[À COMPLÉTER]";
   - transfer safeguards per processor: whether each US processor is certified under the EU-US Data Privacy
     Framework, and that its DPA includes the Commission's standard contractual clauses (SCC);
   - retention: 10 years for billing records (Code de commerce L123-22) is kept by Stripe; confirm nothing else
     must be kept (e.g. proof of consent after deletion — today consents are erased with the account);
   - minimum age of clients (no age check in the app; digital majority in France is 15);
   - wording of the "not a medical device" notice for a coach who is not a health professional;
   - whether a DPIA (AIPD) is required for health data at this scale (CNIL list of required DPIAs);
   - CGV / conditions d'abonnement (right of withdrawal for a monthly online service) are NOT covered here. */
(function () {
  "use strict";
  var h2 = function (t) { return "<h2>" + t + "</h2>"; };
  var p = function (t) { return "<p>" + t + "</p>"; };
  var ul = function (items) { return "<ul><li>" + items.join("</li><li>") + "</li></ul>"; };

  window.MB_LEGAL = {
    version: "2026-11",
    short: "Estimations indicatives, pas un suivi médical.",
    consentText:
      "J’accepte que MB NUTRITION traite mes données de santé (pas, fréquence cardiaque, sommeil, poids, mensurations, " +
      "cycle, photos) pour le suivi de mon coaching. C’est facultatif et je peux retirer mon accord à tout moment dans " +
      "l’appli. Sans accord, ces données restent sur mon téléphone et ne sont pas envoyées au coach.",
    privacyHtml: [
      h2("Qui est responsable de vos données"),
      p("BEGUE Melvin, entreprise individuelle (MB NUTRITION), SIRET 981 481 864 00016, " +
        "[À COMPLÉTER : adresse]. Contact : <a href=\"mailto:melvin.begue@gmail.com\">melvin.begue@gmail.com</a>."),

      h2("Données utilisées"),
      ul([
        "Compte : e-mail, prénom, profil (salle, objectif, régime, allergies).",
        "Suivi : repas, eau, entraînements, bilans hebdomadaires, messages avec le coach, rendez-vous.",
        "Données de santé, avec votre accord : pas, fréquence cardiaque, sommeil, poids, mensurations, cycle menstruel, photos de repas et de progression.",
        "Abonnement : statut et dates. Les données de carte bancaire sont traitées par Stripe ; nous ne les voyons jamais.",
      ]),

      h2("Pourquoi"),
      ul([
        "Fournir le coaching : plan, suivi, chat, calls, rappels et notifications.",
        "Gérer l’abonnement et la facturation.",
        "Estimer le contenu d’un repas à partir d’une photo, quand vous le demandez.",
      ]),
      p("Aucune publicité, aucune revente, aucun profilage commercial."),

      h2("Sur quelle base"),
      ul([
        "Le contrat de coaching (article 6.1.b du RGPD) pour le compte, le suivi, le chat, les calls et l’abonnement.",
        "Votre consentement explicite (article 9.2.a du RGPD) pour les données de santé. Vous pouvez le retirer à tout moment " +
          "dans l’appli ; cela ne remet pas en cause ce qui a été fait avant, et les nouvelles données de santé ne sont plus envoyées.",
        "L’obligation légale (article 6.1.c) pour conserver les pièces comptables.",
      ]),

      h2("Qui y a accès"),
      p("Votre coach, Melvin BEGUE, et les prestataires techniques suivants, uniquement pour leur service :"),
      ul([
        "Supabase : hébergement de la base et des photos, serveurs dans l’Union européenne.",
        "Stripe : paiement de l’abonnement et factures.",
        "Cal.com : prise de rendez-vous des calls (nom, e-mail, horaire).",
        "Google Firebase : envoi des notifications (identifiant technique de votre téléphone).",
        "Anthropic : analyse d’une photo de repas, seulement quand vous la demandez. La photo n’est pas utilisée pour entraîner leurs modèles.",
        "Open Food Facts : quand vous scannez un produit, seul le code-barres est envoyé.",
        "Apple Santé / Health Connect : lus sur votre téléphone, avec votre permission.",
      ]),

      h2("Transferts hors de l’Union européenne"),
      p("Stripe, Cal.com, Google et Anthropic sont des sociétés américaines : certaines données peuvent être traitées aux " +
        "États-Unis. Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne et, " +
        "lorsque la société y adhère, par le cadre de protection des données UE–États-Unis (Data Privacy Framework)."),

      h2("Combien de temps"),
      ul([
        "Vos données sont gardées tant que votre compte existe, et supprimées quand vous supprimez votre compte.",
        "Les factures et pièces comptables sont conservées 10 ans (article L123-22 du Code de commerce), chez Stripe.",
        "Les données gardées sur votre téléphone y restent jusqu’à ce que vous désinstalliez l’appli ou effaciez ses données.",
      ]),

      h2("Vos droits"),
      p("Vous pouvez accéder à vos données, les corriger, les effacer, les récupérer dans un fichier (portabilité), " +
        "retirer votre consentement, vous opposer à un traitement ou demander sa limitation."),
      ul([
        "Dans l’appli : « Exporter mes données » (fichier JSON) et « Supprimer mon compte » (supprime aussi l’abonnement en cours, sans prélèvement suivant).",
        "Par e-mail : <a href=\"mailto:melvin.begue@gmail.com\">melvin.begue@gmail.com</a>. Réponse sous un mois.",
      ]),
      p("Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL : " +
        "<a href=\"https://www.cnil.fr/fr/plaintes\" target=\"_blank\" rel=\"noopener\">cnil.fr/fr/plaintes</a>, " +
        "3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07."),

      h2("Pas un avis médical"),
      p("MB NUTRITION n’est pas un dispositif médical. Calories, macros, estimations par photo, phase du cycle et autres " +
        "chiffres sont indicatifs. Ils ne remplacent pas l’avis d’un médecin ou d’un diététicien. En cas de problème de santé, " +
        "de grossesse ou de trouble du comportement alimentaire, consultez un professionnel de santé."),

      h2("Cookies et stockage local"),
      p("L’appli enregistre vos données sur votre téléphone pour fonctionner hors ligne, et garde votre connexion. " +
        "Pas de cookie publicitaire, pas de mesure d’audience, pas de traceur."),
    ].join(""),
  };
})();
