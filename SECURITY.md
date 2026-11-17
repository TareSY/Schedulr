# Security Policy & Architecture

**Schedulr** is designed for public hosting on GitHub Pages with zero backend servers, zero tracking, and zero credentials.

## Embedded Security Controls

1. **Strict Content Security Policy (CSP)**
   - Enforced via `<meta http-equiv="Content-Security-Policy">` in `index.html`.
   - `default-src 'none'` with `script-src 'self'` blocks inline `<script>` execution, inline event handlers (`onclick`, `onerror`, etc.), `eval()`, and unauthorized outbound network calls.
   - `object-src 'none'`, `base-uri 'self'`, and `form-action 'self'` prevent plugin/base/form hijacking.
   - `upgrade-insecure-requests` ensures subresources load over HTTPS.

2. **Token Privacy (`no-referrer` + History Cleanup)**
   - `<meta name="referrer" content="no-referrer" />` prevents `?c=...` campaign tokens and `?r=...` player response tokens in the address bar from ever being sent in HTTP `Referer` headers to external font hosts.
   - After parsing incoming `?c=` or `?r=` tokens, `window.history.replaceState(...)` removes them from the address bar.

3. **XSS & Prototype Pollution Prevention (`app.js`)**
   - Every user-supplied or URL-decoded field rendered into HTML passes through `escapeHtml()` and strict length/control-character sanitization (`cleanString()`, `cleanId()`).
   - `safeJsonParse()` uses a `JSON.parse` reviver that strips `__proto__`, `constructor`, and `prototype` keys from URL tokens, paste codes, and `localStorage` data.
   - Enum fields (`votes`, `classVibe`, `hosting`, `activeView`, `activeFilter`) and numeric bounds (`MAX_TOKEN_LENGTH = 8192`, `MAX_DATES = 24`, `MAX_PLAYERS = 30`, `quorum` 2–12) are strictly validated before rendering or storing.

4. **Zero-Server / Zero-Secret Design**
   - No API keys, tokens, cookies, analytics, or remote database connections exist anywhere in the codebase.
   - All scheduling state stays locally in your browser's `localStorage` (`schedulr_state_v4`) or explicitly inside links/codes you choose to share.

## Reporting a Vulnerability

If you discover a security issue in this public repository, please open a private security advisory on GitHub (**Security → Advisories → Report a vulnerability**) rather than posting an exploit publicly.
