# dpdpstack-js-sdk

Official JS/TS client for the [DPDPStack](https://getdpdp.net) API — DPDP Act
consent, erasure, audit, DSR/breach workflows, and verifiable Certificates of
Erasure. Zero runtime dependencies; works in Node 18+ and the browser.

> This is the SDK for the **hosted platform** API. The open-source erasure
> engine is the Python package [`dpdpstack`](https://pypi.org/project/dpdpstack/).

## Install

```bash
npm install dpdpstack-js-sdk
```

Or drop it on a page via CDN (exposes `window.dpdpstack`):

```html
<script src="https://cdn.jsdelivr.net/npm/dpdpstack-js-sdk/dist/dpdpstack.global.js"></script>
```

## API keys

| Key | Prefix | Use | Capabilities |
|---|---|---|---|
| **Secret** | `dpdp_sk_…` | Server-side only | Full access |
| **Publishable** | `dpdp_pk_…` | Safe in the browser | Read purposes + record consent only |

A publishable key is the **only** kind that should ever reach a browser. Set an
origin allowlist on it in the dashboard. Some endpoints (certificate verify /
registry / public-key) are fully public and need no key.

## Quick start (server)

```ts
import { DPDPStack, DPDPError } from "dpdpstack-js-sdk";

const dpdp = new DPDPStack({ apiKey: process.env.DPDP_SECRET_KEY }); // dpdp_sk_…

await dpdp.grantConsent({ principal_ref: "user_42", purpose: "marketing" });

const cert = await dpdp.certificates.issue({ principal_ref: "user_42", purpose: "marketing" });
const { valid } = await dpdp.certificates.verify(cert.certificate_jwt);

try {
  await dpdp.requestErasure({ principal_ref: "user_42" });
} catch (err) {
  if (err instanceof DPDPError) console.error(err.status, err.detail);
}
```

> `principal_ref` is **your** opaque user id (an internal id or hash) — never an
> email, name, or other PII.

## Consent widget (browser)

```ts
import { DPDPStack, mountConsentWidget } from "dpdpstack-js-sdk";

const dpdp = new DPDPStack({ apiBase: "/api/v1", apiKey: "dpdp_pk_…" });

const widget = mountConsentWidget("#consent", {
  client: dpdp,
  principalRef: "user_123",
  locale: "en",                 // notices are shown per-locale, English fallback
  onSave: (receipts) => console.log(receipts),
});

widget.setLocale("hi");         // switch language
widget.destroy();               // remove from the DOM
```

Purposes are fetched via the API when omitted; pass `purposes: [...]` to render
inline. See [`examples/browser.html`](./examples/browser.html).

## Configuration

```ts
new DPDPStack({
  apiKey: "dpdp_sk_… | dpdp_pk_…",  // omit for public-only calls
  apiBase: "https://getdpdp.net/api/v1", // default; use "/api/v1" for a same-origin proxy
  fetch: customFetch,                // optional (Node < 18, tests)
  headers: { "X-Trace": "…" },       // sent with every request
  credentials: "include",            // optional fetch credentials mode
});
```

Every non-2xx response throws a `DPDPError` with `.status`, `.detail`, and `.body`.

## Methods

The SDK mirrors the HTTP API; field names match the wire format exactly.

| Area | Methods |
|---|---|
| **Consent** | `listPurposes()` · `createPurpose()` · `grantConsent()` · `withdrawConsent()` · `consentStatus(ref)` · `listConsentRecords()` · `recordActivity()` |
| **Erasure** | `requestErasure()` · `confirmErasure(token)` |
| **Audit** | `getAuditLog({ principal_ref? })` |
| **Retention** | `retention.list()` · `retention.upsert()` · `retention.run({ dry_run? })` |
| **Certificates** | `certificates.issue()` · `certificates.verify(jwt)` · `certificates.publicKey()` · `certificates.registry(fp)` · `certificates.issueFromEvidence()` |
| **Evidence** | `evidence.ingest()` · `evidence.list({ source?, subject? })` |
| **DSR** | `dsr.list()` · `dsr.create()` · `dsr.get(id)` · `dsr.act(id, { action })` |
| **Breaches** | `breaches.list()` · `breaches.report()` · `breaches.get(id)` · `breaches.act(id, { action })` · `breaches.notifications(id)` |
| **Targets** | `targets.list()` · `targets.create()` · `targets.get(id)` · `targets.update(id)` · `targets.remove(id)` |
| **Erasure tasks** | `erasureTasks.list()` · `erasureTasks.retry(id)` |

Public (no key): `certificates.verify`, `certificates.registry`,
`certificates.publicKey`, `confirmErasure`.

## Build from source

```bash
npm install
npm run build      # → dist/ (ESM, CJS, IIFE, .d.ts)
npm run typecheck
```

## Releasing (CI/CD)

Publishing is automated by GitHub Actions ([.github/workflows/publish.yml](.github/workflows/publish.yml)).

**One-time setup:** add an npm **automation** token as a repo secret named `NPM_TOKEN`
(npm → Access Tokens → Generate → *Automation* → copy → GitHub repo → Settings →
Secrets and variables → Actions → New repository secret).

**To cut a release:**

```bash
npm version patch        # bump package.json + create tag vX.Y.Z (minor/major as needed)
git push --follow-tags   # pushing the tag triggers the publish workflow
```

The workflow runs typecheck + build, checks the tag matches `package.json`, then
publishes to npm with provenance. The CDN (jsDelivr / unpkg) updates automatically.
`.github/workflows/ci.yml` runs typecheck + build on every push/PR.

> Provenance needs a **public** repo. On a private repo, remove `--provenance`
> from the publish step.

## License

MIT
