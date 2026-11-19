# Chart snapshots

A saved copy of each size chart we copy numbers from (PDF, screenshot or saved page),
so a seed row can be checked against what the brand printed even after the page changes.

- Not committed: the charts aren't ours to redistribute. Everything here except this
  README is git-ignored, like `photo-sources/`.
- Name the file after the garment id, e.g. `gildan-5000.pdf`, and point to it from the
  seed row: `"source": { …, "snapshot": "chart-snapshots/gildan-5000.pdf" }`.
- `npm run data:check` says whether each garment's snapshot is on this machine. A fresh
  clone won't have them: open the row's `source.url` and save a new copy (note the date).

See `docs/adding-garments.md` for the full checklist.
