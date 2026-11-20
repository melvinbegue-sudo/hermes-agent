---
name: btp-veille-chantiers
description: "Veille BTP : surveiller les appels d'offres de travaux (BOAMP, marchés publics français) par département et mots-clés, avec digest quotidien dédupliqué à livrer sur Telegram/WhatsApp."
version: 1.0.0
author: melvinbegue-sudo
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [BTP, veille, appels-offres, BOAMP, marchés-publics, leads, prospection, chantiers]
    category: business-development
    requires_toolsets: [terminal]
---

# Veille chantiers BTP

Surveille les avis de marchés publics de travaux publiés au **BOAMP** (Bulletin
officiel des annonces de marchés publics) via l'API open data officielle de la
DILA. Conçu pour un apporteur d'affaires BTP : filtrage par départements et
mots-clés métier, digest quotidien qui ne remonte que les avis jamais vus.

Aucune clé API, aucune dépendance (Python stdlib uniquement).

## Quand utiliser ce skill

- L'utilisateur demande les nouveaux appels d'offres / chantiers / marchés de
  travaux dans une zone → `boamp` ou `digest`
- Un cron de veille quotidienne se déclenche → `digest`, puis résumer et livrer
- L'utilisateur veut changer sa zone ou ses mots-clés de veille → `setup`
- Une requête échoue avec une erreur de champ → `schema` pour vérifier les
  noms de champs réels du dataset, puis adapter

## Prérequis

Python 3.8+. Script :

```bash
VEILLE=~/.hermes/skills/btp-veille-chantiers/scripts/btp_veille.py
```

## Configuration initiale (une fois)

Demander à l'utilisateur ses départements et ses mots-clés métier, puis :

```bash
python3 $VEILLE setup --departements 69,01,38 \
  --mots-cles "rénovation,gros œuvre,maçonnerie,réhabilitation" \
  --jours 7 --limit 50
```

Le profil est stocké dans `~/.hermes/btp-veille/config.json` (surchargeable via
`BTP_VEILLE_DIR`). Afficher le profil courant : `python3 $VEILLE config`.

Conseil : des mots-clés trop précis font rater des avis — l'objet d'un marché
est rédigé librement par l'acheteur. Mieux vaut des termes de lot génériques
(« gros œuvre », « démolition », « VRD », « charpente ») que des expressions
longues. Sans mots-clés, la veille remonte tous les marchés des départements
choisis, tous types confondus — c'est un bon réglage de départ, quitte à
affiner ensuite.

## Commandes

### digest — la commande du cron quotidien

```bash
python3 $VEILLE digest
```

Interroge le BOAMP avec le profil enregistré et n'affiche que les avis **non
vus lors des digests précédents** (déduplication par `idweb`, état dans
`~/.hermes/btp-veille/seen.json`). Sortie vide → « Rien de nouveau ». Ajouter
`--json` pour la sortie structurée.

### boamp — requête ponctuelle

```bash
python3 $VEILLE boamp --departements 75,92 --mots-cles "désamiantage" --jours 3
python3 $VEILLE boamp --departements 69 --jours 1 --json
```

Ne touche pas à l'état de déduplication — utilisable librement pour explorer.

### schema — auto-réparation

```bash
python3 $VEILLE schema
```

Liste les champs réels du dataset. À utiliser si une requête renvoie une
erreur ODSQL : la DILA peut renommer des champs. Le script a déjà un repli
automatique (il rejoue la requête sans tri ni projection), mais `schema`
permet de corriger durablement les filtres.

### --dry-run

`boamp`, `digest` et `schema` acceptent `--dry-run` : affiche l'URL d'API qui
serait appelée, sans réseau. Utile pour déboguer un filtre.

## Mise en place du cron quotidien

Utiliser le scheduler cron d'Hermes pour exécuter chaque matin :

```bash
python3 ~/.hermes/skills/btp-veille-chantiers/scripts/btp_veille.py digest
```

puis livrer le résultat sur la plateforme de l'utilisateur (Telegram,
WhatsApp…). Cadence recommandée : tous les jours à 7h30 heure locale, le BOAMP
publie tôt le matin.

En présentant le digest, ne pas coller la sortie brute :

1. **Classer par pertinence** pour le métier de l'utilisateur (ses corps
   d'état, ses zones), pas par date.
2. **Signaler les dates limites de réponse proches** (< 10 jours) en tête.
3. Pour chaque avis retenu : objet reformulé en une ligne, acheteur,
   département, date limite, lien BOAMP.
4. Terminer par le nombre d'avis écartés et pourquoi, en une phrase.

## Sources et limites

- **Couvert** : marchés publics de travaux (État, collectivités, bailleurs
  sociaux, hôpitaux…) publiés au BOAMP. Les gros marchés européens (JOUE) y
  sont largement repris.
- **Non couvert** : chantiers privés et permis de construire. Les données
  Sitadel (permis) sont publiées en CSV mensuels volumineux sans API de
  filtrage fiable — pour un besoin ponctuel, utiliser la recherche web ou le
  navigateur sur le portail urbanisme de la collectivité visée. Extension
  prévue si une API stable apparaît.
- Licence des données : Licence Ouverte (DILA). Réutilisation libre avec
  mention de la source.
