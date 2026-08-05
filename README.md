# Homebound – Journey & Dreams Recovery v3

This release repairs the corrupted all-zero Journey state created by the failed migration.

- Restores the last verified debt balances only when all debts are zero and there is no payment evidence.
- Preserves genuine paid-off debts and saved payment history.
- Rebuilds the Family Story milestone cards.
- Restores the six default Dream Board cards while preserving custom dreams and trips.
- Uses a fresh service-worker cache.

Upload every file and the `assets` folder to the repository root, replacing matching files.
