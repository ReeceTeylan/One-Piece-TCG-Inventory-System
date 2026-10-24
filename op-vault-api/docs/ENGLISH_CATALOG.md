# OP Vault — English card catalog

Quick Add checks the `card_catalog_entries` table before it falls back to TCGplayer's and the small built-in name dictionary.

## Populating the catalog

1. Obtain a legal, maintained English catalog export. It should be an array of objects or an index keyed by `OP01-001`, with English `name` and ideally `colors`, `rarity`, and `category`.
2. Review the source license, terms, language, and card-set coverage.
3. Run the schema migration against a staging DB first.
4. From `op-vault-api` run `npm run catalog:import -- /path/to/cards_by_id.json` after configuring the database connection.
5. Check samples against the official card database, especially newer releases.

The import script NEVER imports card artwork. It only stores metadata. The catalog maps base card numbers, not variant artworks. Exact printings remain determined by the user's chosen marketplace listing. It does not automatically rewrite existing records.

Do not run the importer blindly against production; test new data on staging and back up before import.

## Prepare a verified metadata snapshot

The repository includes `scripts/prepare-english-catalog.py` and `.github/workflows/english-catalog-prepare.yml` to prepare metadata from [OPTCG English Cards](https://huggingface.co/datasets/t22000t/optcg-en-cards), maintained by optcg-cards contributors.

- Dataset normalization is licensed CC BY 4.0; the card-game names and underlying IP remain subject to the rights holders' terms. No images or text effects are copied.
- Run the GitHub Action manually, or collect its monthly artifact. It **does not modify production**.
- Download the `english-catalog-review` artifact, inspect `english-catalog.manifest.json` (including input SHA-256) and `english-catalog.unresolved.json`, and check sample names/colors against official references.
- Only after the production migration, backup, and staging restore checks: import reviewed JSON using `npm run catalog:import -- data/english-catalog.json` in an authorized backend environment. It upserts the canonical table without changing existing inventory records.
- Attribution: OPTCG English Cards, optcg-cards contributors (2026), https://huggingface.co/datasets/t22000t/optcg-en-cards, dataset normalization licensed CC BY 4.0.
- Artwork/parallel printing remains determined by the exact market listing key, not the base English catalog.
