# Security Policy

## Scope

DeutschSphere is a **fully client-side, static Progressive Web App**. It has:

- **no backend server, database, or API** we operate,
- **no user accounts, authentication, or credentials**,
- **no analytics, tracking, cookies, or third-party requests on load** (fonts and
  icons are self-hosted; see [PRIVACY.md](PRIVACY.md)).

All learning data stays in the user's own browser (`localStorage` + IndexedDB). The
only optional outbound request is the feedback form, sent to a third-party form
relay **only** when a user explicitly submits it.

Because there is no server and no user data leaves the device, the realistic
security surface is limited to the client bundle itself — e.g. a cross-site
scripting (XSS) vector in how card/user content is rendered, a Content-Security-Policy
weakness, or a supply-chain issue (note: the app ships **zero runtime dependencies**).

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for an
unfixed vulnerability.

- Preferred: use GitHub's **[Private vulnerability reporting](https://github.com/Khanna-Aman/DeutschSphere/security/advisories/new)**
  (Security → Report a vulnerability).
- Include: affected file/component, reproduction steps, and impact.

We aim to acknowledge reports within a few days. As a free, non-commercial project
maintained in spare time, we cannot guarantee formal SLAs, but security fixes are
prioritized over features.

## What is *not* a vulnerability

- The feedback form posting to a third-party relay (documented, opt-in, no personal
  data beyond what the user types).
- The browser `SpeechRecognition` (Web Speech API) sending audio to the browser
  vendor's service during pronunciation practice — this is a browser behavior,
  disclosed under [PRIVACY.md → Pronunciation & microphone](PRIVACY.md#pronunciation--microphone),
  not an app data flow.
