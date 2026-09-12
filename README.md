# Puja Location Auditor

Small browser-based auditor for the merged Puja Excel dataset.

## What it does
- Loads `.xlsx` / `.xls` in the browser.
- Lists every spreadsheet row, including rows without a Puja Code.
- For each row, shows up to four location candidates:
  - existing `Google Maps URL`
  - D1 generated from `D1 Latitude` + `D1 Longitude`
  - D2 generated from `D2 Latitude` + `D2 Longitude`
  - D4 existing `D4 Gmaps Link`, or generated from `D4 Latitude` + `D4 Longitude`
- Opens candidate links in Google Maps (Android should hand them to the Maps app when installed).
- Lets the auditor mark D1/D2/D4/Google Maps as correct, or enter a corrected Google Maps URL.
- Exports the original dataset with four appended columns:
  - `Verified Location Source`
  - `Verified Google Maps Link`
  - `Location Verification Status`
  - `Location Verified At`

## Run locally on Linux
From this folder:

```bash
python3 -m http.server 8000
```
Then open:

```text
http://localhost:8000
```

## Put it on the internet
This is static, so it can be hosted on GitHub Pages, Cloudflare Pages, Netlify, etc. No server/database is required for the basic single-auditor workflow.

## Important persistence behavior
The browser cannot reliably overwrite an arbitrary Excel file on Android. The tool therefore works as:

Excel upload → audit → Export audited Excel

For a later version, we can add IndexedDB autosave/resume, then optionally a backend if multiple auditors need to share the same audit state.
