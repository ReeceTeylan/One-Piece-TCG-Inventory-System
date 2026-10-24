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
