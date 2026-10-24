#!/usr/bin/env python3
"""Prepare owner-reviewable English OPTCG card metadata from a text-only CC BY dataset.
Run: python -m pip install 'pyarrow==20.0.0'
     python scripts/prepare-english-catalog.py --output ./data/english-catalog.json
This never downloads or stores card images and does NOT access the OP Vault database.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import re
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SOURCE = "https://huggingface.co/datasets/t22000t/optcg-en-cards/resolve/main/cards.parquet"
CITATION = "https://huggingface.co/datasets/t22000t/optcg-en-cards"
ID = re.compile(r"^([A-Z0-9]+-\d{2,3})(?:_p\d+)?$")
JP = re.compile(r"[\u3040-\u30ff\u3400-\u9fff]")
COLOR = {"Red", "Blue", "Green", "Purple", "Black", "Yellow"}

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="data/english-catalog.json")
    args = parser.parse_args()
    try:
        import pyarrow.parquet as parquet
    except ImportError:
        raise SystemExit("Install pyarrow==20.0.0 before preparing the catalog")
    request = urllib.request.Request(SOURCE, headers={"User-Agent":"OP-Vault-Card-Metadata-Importer/1.0"})
    with urllib.request.urlopen(request, timeout=50) as response:
        content = response.read(8_000_001)
    if len(content) > 8_000_000:
        raise SystemExit("Unexpectedly large dataset; aborting")
    digest = hashlib.sha256(content).hexdigest()
    raw = parquet.read_table(io.BytesIO(content), columns=["id","name","card_type","colors","set_code","rarity"]).to_pylist()
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in raw:
        match = ID.fullmatch(str(row.get("id", "")).upper())
        name = str(row.get("name") or "").strip()
        if match and name and len(name) <= 160 and not JP.search(name):
            grouped[match.group(1)].append(row)
    entries = {}
    conflicts = {}
    for cid, records in sorted(grouped.items()):
        names = {r["name"].strip() for r in records}
        if len(names) != 1:
            conflicts[cid] = sorted(names)
            continue
        known_colors = [tuple(c for c in (r.get("colors") or []) if c in COLOR) for r in records]
        colors = list(known_colors[0]) if known_colors and len(set(known_colors)) == 1 else []
        sets = {str(r.get("set_code") or "").strip() for r in records if r.get("set_code")}
        types = {str(r.get("card_type") or "").strip() for r in records if r.get("card_type")}
        rarities = {str(r.get("rarity") or "").strip() for r in records if r.get("rarity")}
        entries[cid] = {
            "name": next(iter(names)).replace("Monkey.D.Luffy", "Monkey D. Luffy"),
            "colors": colors, "category": next(iter(types)) if len(types) == 1 else "",
            "set": next(iter(sets)) if len(sets) == 1 else cid.split("-")[0],
            "rarity": next(iter(rarities)) if len(rarities) == 1 else ""
        }
    if len(entries) < 1000:
        raise SystemExit(f"Only {len(entries)} cards passed validation; aborting")
    dest = Path(args.output)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(entries, ensure_ascii=False, separators=(",",":")), encoding="utf-8")
    manifest = {
      "source": CITATION, "source_file": SOURCE, "source_sha256":digest,
      "license":"CC BY 4.0 (dataset structure/normalization; rights-holder notice still applies)",
      "retrieved_at": datetime.now(timezone.utc).isoformat(),
      "source_rows":len(raw), "unique_cards":len(entries), "unresolved_conflicts":len(conflicts),
      "images_copied": False
    }
    dest.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    dest.with_suffix(".unresolved.json").write_text(json.dumps(conflicts, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Prepared {len(entries)} English card IDs; {len(conflicts)} ambiguous IDs require review. SHA256 {digest}")

if __name__ == "__main__":
    main()
