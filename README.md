# 🎲 Schedulr *(GrinDM Edition)*

**A Grindr-inspired, zero-fluff Dungeons & Dragons session scheduler.**  
*Stop reading 20 texts over 6 hours without getting a single straight answer.*

Built as a **100% static web app** (`index.html`, `styles.css`, `app.js`) with zero build steps and zero backend required — ready to host straight on **GitHub Pages**.

---

## ✨ Features

- **⚡ Rapid-Fire Check-In ("Straight Answers Only")**
  - Players step through proposed session dates one card at a time (or via rapid list mode) with **only three buttons**:
    - `🔥 DTF (Down To Fantasy)` — Yes, 100% available
    - `🎲 Roll w/ Disadvantage` — Maybe / If desperate
    - `💀 Hard Pass (TPK)` — Unavailable
  - Keyboard shortcuts supported (`1`, `2`, `3`, `←`, `→`).
- **🚫 Anti-Essay Firewall**
  - A satirical excuse box at the bottom actively blocks rambling paragraphs (*"maybe after 8:15pm depending on traffic..."*) with D&D/Grindr roasts and forces players back to the 3 buttons.
- **🟨 The Cascade Grid**
  - **Best Match Banner**: Highlights the top date with quorum + 1-click **"Lock In & Copy Group Verdict"** (with confetti).
  - **Date Match Cascade**: 3-column grid of proposed dates with match percentages, holiday tags, and full breakdowns.
  - **Party Profiles Nearby**: 3-column Grindr-style character grid with custom SVG class avatars, distance tags (*"20 ft away"*, *"In the Tavern"*), hosting status (`🏠 Can Host`), and a **🔥 Tap** nudge button.
- **🎭 Pre-Loaded Demo Mode ("Serge's Holiday D&D Gauntlet")**
  - Works immediately on load with 6 holiday session dates and 5 pre-loaded comedy party profiles.
- **👑 DM Control & Zero-Backend Sharing**
  - **1-Click Holiday Presets**: *Thanksgiving Gauntlet*, *Mid-December Chaos*, *New Year's Eve Marathon*, or *Next 4 Weekends*.
  - **URL-Encoded Invites (`?c=...`)**: The entire campaign schedule lives inside the invite link.
  - **URL / Code Responses (`?r=...` / `SCHEDULR:...`)**: Players click one button to copy their response link or `SCHEDULR:...` text code back to the DM, who pastes or opens it to merge them onto **The Grid**.

---

## 🚀 Deploy to GitHub Pages (`TareSY/Schedulr`)

1. Commit and push `index.html`, `styles.css`, `app.js`, and `README.md` to `main` using **GitHub Desktop**.
2. Open your repository on GitHub: `https://github.com/TareSY/Schedulr`.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, select **`main`** and **`/ (root)`**, and click **Save**.
5. Within ~30–60 seconds, your live app will be available at:
   `https://taresy.github.io/Schedulr/`

---

## 🔒 Security & Privacy

Because this repository is public and hosted statically on GitHub Pages:
- **Zero Secrets & Zero Backend**: No API keys, tracking scripts, analytics, or databases.
- **Strict CSP & No-Referrer**: [index.html](index.html) enforces a strict Content Security Policy (`script-src 'self'`, `object-src 'none'`) and `no-referrer` so shared URL tokens (`?c=...` / `?r=...`) never leak in referrer headers.
- **Input Sanitization & Prototype Pollution Protection**: [app.js](app.js) validates payload bounds, strips dangerous JSON keys (`__proto__`, `constructor`, `prototype`), enforces strict enum allowlists, and HTML-escapes all rendered fields.
- See [SECURITY.md](SECURITY.md) for full details.

---

## 🛠️ Local Development

Since Schedulr uses pure HTML, CSS, and vanilla JavaScript, you can open `index.html` directly in a browser or run any local static server (e.g. `npx serve .` or `python -m http.server`).
