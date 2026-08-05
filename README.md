# Homebound – Journey & Dreams Data Migration Fix

This update repairs the zero-value migration seen after the Journey 2.0 + Dreams deployment.

## Fixes
- Restores the five real debt balances from existing Homebound / Freedom Countdown storage.
- Falls back to the last known tracked balances instead of replacing data with zeroes.
- Preserves genuine zero balances when a payment ledger proves the account was cleared.
- Excludes Security, Our Home and Welcome Home from debt totals.
- Restores all Family Story milestone cards.
- Restores the default Dream Board when an empty array was saved during the failed migration.
- Keeps existing Garden, Today, trip and photo data.
- Uses a new service-worker cache version.

Upload every file and the `assets` folder to the repository root, replacing matching files.
