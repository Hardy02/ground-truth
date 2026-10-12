# Ground Truth

Fictional crimes in real places. Each case is a set of evidence (statements, phones, doorbell logs, records, maps and photos) that you solve by checking it against the real world.

Every case has two modes:

- **Casual (no AI):** the complete case file.
- **Real Life (AI allowed):** a bigger disclosure bundle with sealed evidence you request by reference, camera stills to compare, and a deeper solution.

## Playing

Open the site, pick a case, pick a mode. Your notes and requested records stay in your browser. A correct accusation (every question right) unseals the solution. The case author can also post a reveal key once a case closes.

## Publishing (GitHub Pages)

This folder is the whole site. It's static: no build step on GitHub.

1. Push this folder to a GitHub repository.
2. In the repo, go to **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`.
3. The site appears at `https://<username>.github.io/<repo>/`.

To test it locally, serve the folder over HTTP. Opening the file directly won't work, because the browser blocks the crypto and data loading on `file://`.

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Adding a case

Case sources are **not** in this repository: their plaintext would give the answers away. They live in a private `authoring/` folder next to this one:

```
authoring/
  build.py            # encrypts and writes cases/ into this site
  check.mjs           # smoke test: site crypto opens what build.py sealed
  svg.py, raster.cjs  # draw evidence images, then convert them to JPG
  cases/<slug>/
    meta.py           # title, place, cover, modes
    casual.py         # ITEMS, QUESTIONS, ANSWER, REVEAL_HTML, PASSPHRASE
    reallife.py       # same, plus SEALED (code -> items) and SEALED_HELP
```

1. Create `authoring/cases/<new-slug>/` with `meta.py` and one file per mode.
2. Put images in `cases/<new-slug>/img/` in this site.
3. Run `python authoring/build.py`, which needs `pip install cryptography`. It rewrites `cases/index.json` and each mode's JSON.
4. Run `node authoring/check.mjs` after editing it for the new case's answers.
5. Commit and push this folder.

### Evidence kinds

| kind | Looks like | Key fields |
|---|---|---|
| `doc` | Paper document. `style`: `memo`, `report`, `letter`, `receipt`, `schedule` | `heading`, `ref`, `meta`, `letterhead`, `body` (blocks) |
| `statement` | Police witness statement | `name`, `age`, `occupation`, `taken`, `text` |
| `email` | Email or thread | `subject`, `from`, `to`, `date`, `text` or `thread` |
| `notebook` | Handwritten lined notebook | `pages: [{date, text}]` |
| `phone` | Phone with apps | `apps: [{type: chats/calls/photos/list, …}]` |
| `doorbell` / `cctv` | Camera app event log with stills | `events: [{id, date, time, type, desc, still}]`, `info` |
| `map` | Live map with satellite view and a measuring tool | `center`, `zoom`, `markers` |
| `gallery` | Captioned photographs | `images: [{src, cap, credit}]` |

Body blocks for `doc`:
- a plain string (paragraphs)
- `{h}`
- `{kv: [[k, v]]}`
- `{table: {cols, rows}}`
- `{quote, by}`
- `{list}`
- `{note}`
- `{img, cap}`
- `{sig}`

### How sealing works

Sealed records and solutions are encrypted with AES-256-GCM, using a key derived (PBKDF2-SHA256) from:
- the request code, normalised to `A–Z0–9` only;
- the full set of accusation answers;
- or the reveal key.

The browser decrypts with WebCrypto. Nothing secret is stored in plaintext in this repository.

## Credits

- Location photographs: Wikimedia Commons, credited in each case.
- Hero image: John Atkinson Grimshaw, *Whitby Docks* (public domain).
- Maps: © OpenStreetMap contributors; satellite imagery © Esri.

All people, businesses, phone numbers and events in the cases are fictional.
