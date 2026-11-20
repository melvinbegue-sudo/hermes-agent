#!/usr/bin/env python3
"""Veille BTP : appels d'offres de travaux publiés au BOAMP.

Source : API open data officielle de la DILA
(https://boamp-datadila.opendatasoft.com, dataset "boamp", licence ouverte).

Python stdlib uniquement — aucune dépendance, aucune clé API.

Commandes :
  setup    Enregistrer le profil de veille (départements, mots-clés, ...)
  config   Afficher le profil de veille courant
  boamp    Interroger le BOAMP avec des filtres explicites
  digest   Requête basée sur le profil + déduplication (pour le cron quotidien)
  schema   Lister les champs réels du dataset (auto-réparation si l'API change)

Exemples :
  python3 btp_veille.py setup --departements 69,01,38 --mots-cles "rénovation,gros œuvre"
  python3 btp_veille.py digest
  python3 btp_veille.py boamp --departements 75 --jours 3 --json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

API_BASE = "https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp"
NOTICE_URL = 'https://www.boamp.fr/pages/avis/?q=idweb:"{idweb}"'
USER_AGENT = "hermes-btp-veille/1.0 (skill; +https://github.com/NousResearch/hermes-agent)"

# Champs demandés en priorité ; si l'API renvoie une erreur ODSQL (champ
# renommé côté DILA), la requête est rejouée sans `select` ni `order_by`.
SELECT_FIELDS = [
    "idweb",
    "objet",
    "nomacheteur",
    "dateparution",
    "datelimitereponse",
    "code_departement",
    "famille_libelle",
    "nature_libelle",
]

MAX_SEEN = 5000


def state_dir() -> Path:
    override = os.environ.get("BTP_VEILLE_DIR")
    base = Path(override) if override else Path.home() / ".hermes" / "btp-veille"
    base.mkdir(parents=True, exist_ok=True)
    return base


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_csv_arg(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def build_where(departements: list[str], mots_cles: list[str], jours: int) -> str:
    parts: list[str] = []
    since = (date.today() - timedelta(days=jours)).isoformat()
    parts.append(f"dateparution >= date'{since}'")
    if departements:
        quoted = ", ".join('"{}"'.format(d.replace('"', "")) for d in departements)
        parts.append(f"code_departement in ({quoted})")
    if mots_cles:
        quoted = " OR ".join('"{}"'.format(m.replace('"', "")) for m in mots_cles)
        parts.append(f"({quoted})")
    return " AND ".join(parts)


def api_request(url: str, timeout: int = 45) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_records(where: str, limit: int, dry_run: bool = False) -> list[dict]:
    params = {
        "where": where,
        "order_by": "dateparution desc",
        "select": ", ".join(SELECT_FIELDS),
        "limit": str(limit),
    }
    url = f"{API_BASE}/records?" + urllib.parse.urlencode(params)
    if dry_run:
        print(url)
        return []
    try:
        payload = api_request(url)
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")[:500]
        if err.code == 400:
            # Champ inconnu ou ODSQL refusé : rejouer la requête minimale, le
            # tri et la projection sont du confort, pas une nécessité.
            fallback = {"where": where, "limit": str(limit)}
            url = f"{API_BASE}/records?" + urllib.parse.urlencode(fallback)
            try:
                payload = api_request(url)
                print(
                    "note: requête simplifiée (un champ de tri/projection a été "
                    "refusé par l'API — lancer `schema` pour vérifier les noms de champs)",
                    file=sys.stderr,
                )
            except urllib.error.HTTPError as err2:
                body2 = err2.read().decode("utf-8", errors="replace")[:500]
                sys.exit(f"erreur API BOAMP ({err2.code}): {body2}")
        else:
            sys.exit(f"erreur API BOAMP ({err.code}): {body}")
    except urllib.error.URLError as err:
        sys.exit(f"erreur réseau vers boamp-datadila.opendatasoft.com : {err.reason}")
    return payload.get("results", [])


def notice_link(record: dict) -> str:
    idweb = record.get("idweb")
    return NOTICE_URL.format(idweb=idweb) if idweb else ""


def format_record(record: dict) -> str:
    deps = record.get("code_departement")
    if isinstance(deps, list):
        deps = "/".join(str(d) for d in deps)
    lines = [
        f"[{record.get('dateparution', '?')}] dépt {deps or '?'} — {record.get('nomacheteur', 'acheteur inconnu')}",
        f"  {record.get('objet', '(objet non renseigné)')}",
    ]
    deadline = record.get("datelimitereponse")
    if deadline:
        lines.append(f"  Date limite de réponse : {deadline}")
    extra = " · ".join(
        str(record[k]) for k in ("famille_libelle", "nature_libelle") if record.get(k)
    )
    if extra:
        lines.append(f"  {extra}")
    link = notice_link(record)
    if link:
        lines.append(f"  {link}")
    return "\n".join(lines)


def print_records(records: list[dict], as_json: bool) -> None:
    if as_json:
        print(json.dumps(records, ensure_ascii=False, indent=2))
        return
    if not records:
        print("Aucun avis trouvé pour ces critères.")
        return
    print(f"{len(records)} avis :\n")
    print("\n\n".join(format_record(r) for r in records))


def cmd_setup(args) -> None:
    config = {
        "departements": parse_csv_arg(args.departements),
        "mots_cles": parse_csv_arg(args.mots_cles),
        "jours": args.jours,
        "limit": args.limit,
    }
    path = state_dir() / "config.json"
    save_json(path, config)
    print(f"Profil de veille enregistré dans {path} :")
    print(json.dumps(config, ensure_ascii=False, indent=2))


def cmd_config(_args) -> None:
    config = load_json(state_dir() / "config.json", None)
    if config is None:
        sys.exit("Aucun profil de veille — lancer d'abord la commande `setup`.")
    print(json.dumps(config, ensure_ascii=False, indent=2))


def cmd_boamp(args) -> None:
    where = build_where(parse_csv_arg(args.departements), parse_csv_arg(args.mots_cles), args.jours)
    records = fetch_records(where, args.limit, dry_run=args.dry_run)
    if not args.dry_run:
        print_records(records, args.json)


def cmd_digest(args) -> None:
    config = load_json(state_dir() / "config.json", None)
    if config is None:
        sys.exit("Aucun profil de veille — lancer d'abord la commande `setup`.")
    where = build_where(
        config.get("departements", []),
        config.get("mots_cles", []),
        config.get("jours", 7),
    )
    records = fetch_records(where, config.get("limit", 50), dry_run=args.dry_run)
    if args.dry_run:
        return

    seen_path = state_dir() / "seen.json"
    seen = load_json(seen_path, {"seen": []})["seen"]
    seen_set = set(seen)
    new_records = [r for r in records if r.get("idweb") and r["idweb"] not in seen_set]

    if new_records:
        seen.extend(r["idweb"] for r in new_records)
        save_json(seen_path, {"seen": seen[-MAX_SEEN:]})

    if args.json:
        print(json.dumps(new_records, ensure_ascii=False, indent=2))
    elif not new_records:
        print("Rien de nouveau depuis le dernier digest.")
    else:
        print(f"{len(new_records)} nouvel(s) avis depuis le dernier digest :\n")
        print("\n\n".join(format_record(r) for r in new_records))


def cmd_schema(args) -> None:
    if args.dry_run:
        print(API_BASE)
        return
    try:
        payload = api_request(API_BASE)
    except urllib.error.URLError as err:
        sys.exit(f"erreur réseau vers boamp-datadila.opendatasoft.com : {err}")
    fields = payload.get("fields", [])
    if not fields:
        print(json.dumps(payload, ensure_ascii=False, indent=2)[:3000])
        return
    for field in fields:
        print(f"{field.get('name')}  ({field.get('type')}) — {field.get('label', '')}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_setup = sub.add_parser("setup", help="enregistrer le profil de veille")
    p_setup.add_argument("--departements", help="codes département, séparés par des virgules (ex: 69,01,38)")
    p_setup.add_argument("--mots-cles", help="mots-clés plein texte, séparés par des virgules")
    p_setup.add_argument("--jours", type=int, default=7, help="fenêtre de parution en jours (défaut: 7)")
    p_setup.add_argument("--limit", type=int, default=50, help="nombre max d'avis par digest (défaut: 50, max API: 100)")
    p_setup.set_defaults(func=cmd_setup)

    p_config = sub.add_parser("config", help="afficher le profil de veille")
    p_config.set_defaults(func=cmd_config)

    p_boamp = sub.add_parser("boamp", help="requête ponctuelle avec filtres explicites")
    p_boamp.add_argument("--departements", help="codes département, séparés par des virgules")
    p_boamp.add_argument("--mots-cles", help="mots-clés plein texte, séparés par des virgules")
    p_boamp.add_argument("--jours", type=int, default=7)
    p_boamp.add_argument("--limit", type=int, default=30)
    p_boamp.add_argument("--json", action="store_true", help="sortie JSON brute")
    p_boamp.add_argument("--dry-run", action="store_true", help="afficher l'URL de requête sans appeler l'API")
    p_boamp.set_defaults(func=cmd_boamp)

    p_digest = sub.add_parser("digest", help="nouveaux avis depuis le dernier digest (profil + déduplication)")
    p_digest.add_argument("--json", action="store_true")
    p_digest.add_argument("--dry-run", action="store_true")
    p_digest.set_defaults(func=cmd_digest)

    p_schema = sub.add_parser("schema", help="lister les champs réels du dataset BOAMP")
    p_schema.add_argument("--dry-run", action="store_true")
    p_schema.set_defaults(func=cmd_schema)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
