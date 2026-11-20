/* Connexion au serveur MB NUTRITION (Supabase).
   Laissez vide = mode local : l'appli marche comme aujourd'hui, tout reste sur le téléphone.
   Pour activer comptes, synchro, espace coach et chat : Supabase > Project Settings > API,
   copiez « Project URL » dans supabaseUrl et la clé « anon public » dans supabaseAnonKey.
   calUrl : lien de réservation Cal.com des calls (ex. "https://cal.com/melvin-begue/call").
   stripeLink : Stripe › Liens de paiement, abonnement 87 €/mois, collez l'URL https://buy.stripe.com/… (utilisé sans serveur).
   Ne mettez JAMAIS ici la clé « service_role » ni la clé Anthropic. Voir supabase/README.md. */
window.MB_CONFIG = { supabaseUrl: "", supabaseAnonKey: "", calUrl: "", stripeLink: "" };
