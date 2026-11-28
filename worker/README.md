# choudo-fetch

The website's fetch service. A web page can't read Uniqlo's JSON itself: Uniqlo sends
no CORS header, so the browser blocks it ("Failed to fetch"). This Cloudflare Worker
asks Uniqlo for the page and hands the answer back with a CORS header for Choudo's
own site. The phone app doesn't need it; it reads Uniqlo directly.

**It is not a general proxy.** It answers one route and only ever calls the two
addresses `uniqloUrls()` builds in `packages/core/domain/links/urls.ts`:

| Request | Calls |
| --- | --- |
| `GET /uniqlo/<code>/size-chart` | Uniqlo US's size chart for that product |
| `GET /uniqlo/<code>/details` | Uniqlo US's product details (name, price, colours, tags) |

`<code>` is a Uniqlo product code (letter + 6 digits + `-` + 3 digits, `E424873-000`).
Anything else is a 404, and any method but GET or OPTIONS is a 405. The request's query
string, headers, cookies and IP never reach Uniqlo; the Worker sends only
`User-Agent: Choudo/1.0 (+https://yoshiryo2.github.io/Choudo/)` and
`Accept: application/json`, and doesn't follow redirects.

## Answers

- Uniqlo's status and body as they are, as `application/json`. Uniqlo's own headers
  (cookies included) are dropped.
- More than 8 s → `504 {"status":"error","reason":"timeout"}`; unreachable or a redirect →
  `502 {"status":"error","reason":"upstream"}`.
- CORS (`Access-Control-Allow-Origin`) only for `https://yoshiryo2.github.io` and the Vite
  servers `http://localhost:5173`, `http://127.0.0.1:5173` and `http://localhost:4173`.
  Any other site gets no CORS header, so its browser won't hand it the answer.
- A 200 whose body says `"status":"ok"` is kept in the Workers cache for 24 h, keyed by the
  Uniqlo address; errors are never cached. Cloudflare documents the cache as working on
  custom domains and doesn't say whether it works on `*.workers.dev`. If it doesn't, every
  check goes to Uniqlo, which is still well inside the free plan.
- No logs: no `console.log`, and Workers Logs are off (`[observability] enabled = false`).
  Cloudflare still counts requests on the dashboard.

The code is `src/handle.ts`; `src/index.ts` is the entry, which may export only the
handler (the runtime treats any other export as an entry point).

## Setup (once, about 10 minutes)

1. Sign up at cloudflare.com (free). In the dashboard, open **Workers & Pages** once so the
   account gets a `*.workers.dev` subdomain; note that subdomain.
2. **My Profile → API Tokens → Create Token**, use the **Edit Cloudflare Workers** template,
   create it and copy the token.
3. Copy the **Account ID** from the Workers & Pages overview page.
4. GitHub → YoshiRyo2/Choudo → **Settings → Secrets and variables → Actions**: add
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
5. Deploy: `.github/workflows/deploy-worker.yml` runs on every push to `main` that touches
   `worker/` or `packages/core/domain/links/`, or by hand (Actions → Deploy fetch service →
   Run workflow). Without the secrets it's skipped with a notice, not failed. Once it runs,
   the address is `https://choudo-fetch.<your-subdomain>.workers.dev`. The job's smoke test
   prints it, waits up to 3 minutes for a fresh address to go live (Cloudflare shows its own
   404 page until then), checks `/anything-else` is a 404, and reports what Uniqlo's size
   chart answered (a warning, never a failure, if it isn't 200).

Free plan: 100,000 requests a day (resets at midnight UTC). A check is two requests.

## Locally

From the repo root, after `npm install`:

```bash
npm run dev -w worker      # wrangler dev at http://localhost:8787
npm run check -w worker    # typecheck + tests (also part of the root npm run check)
```

Then open `http://localhost:8787/uniqlo/E424873-000/size-chart`. `wrangler dev` runs the
real Workers runtime on your machine, so Uniqlo sees your connection, not Cloudflare's.
