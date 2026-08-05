# Homebound — Family Hero + Journey Save Fix

This update includes:

- Static anime-inspired hero illustration of a couple viewed from behind, looking toward their future home
- Removes the floating emoji portrait
- Replaces the unexplained “287 steps” with the real total amount cleared from Journey data
- Keeps the time-based greeting
- Uses a real submit-based Journey payment form on iPhone
- Persists payments to Homebound state, the separate payment ledger, and the legacy Freedom Countdown balance
- Verifies writes before showing success and rolls back cleanly if storage fails
- Refreshes the milestone and Payment History immediately after saving
- New service-worker cache version

Upload every file and the `assets` folder to the repository root, replacing matching files.


Version v7: direct payment button handler, single canonical state write, read-back verification, visible save errors.
