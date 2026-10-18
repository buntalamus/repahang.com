# Original RefPahang templates

The forms in `api/templates/*.php` and the printable PHP views are the authoritative originals. They must not be redesigned or replaced by an approximate HTML form.

This private Worker runs the same PHP 8.3 / TCPDF 6.11.2 templates in WebAssembly. It has no public route, workers.dev hostname, database, storage, mail sender, or credentials. The main Worker authenticates and scopes the data, then calls its `ORIGINAL_TEMPLATES` service binding. Fixed entrypoints receive JSON data only; they accept no PHP or SQL source. A serialized, bounded queue reuses one PHP heap and deletes all request files, credentials, and captured email output after every request. Rendering an email does not send it.

`bundle.generated.mjs` is a reproducible ZIP of the original PHP functions/views, TCPDF, fonts and logo. `source-manifest.json` records source SHA-256 values. TCPDF's GD logo/plain soft-mask output is prepared at build time; the original logo and its transparency are preserved. PNG profile photos get the same image/soft-mask preprocessing. Official template drawing coordinates, font metrics and wording run in the original PHP, not a TypeScript reconstruction.

The packaging adapter removes bootstrap/database delivery code and supplies rows already authorized by the main Worker. The only presentation-source substitutions are the site's own logo URL, historical/future application season values, and the later approved Telegram requirement/role distinction in welcome messages. Application receipts show the actual PP/Admin review status. Existing current deadline, recipient scope, annual registration/seminar/fitness/license rules and new notifications remain in the main Worker.

## Build and verify

Use Node 22, PHP 8.3 with GD and ZIP, Python 3, Poppler, and Chrome for visual comparison. The generated archive is committed so the deployed Worker does not need PHP installed on a host.

```sh
npm run build:original-templates --prefix cloudflare
npx --prefix cloudflare wrangler dev --config cloudflare/legacy-renderer/wrangler.jsonc --port 4198 --persist-to /tmp/refpahang-original-state
# In another terminal:
npm run test:original-templates --prefix cloudflare
```

The parity harness runs the original PHP locally and the same fixed templates in workerd. It compares HTML, verifies PDF bodies, checks each role's links, and exercises concurrent-recipient isolation and recovery. Generated proofs are private QA artifacts under `output/template-restoration/`, not deployment assets.

`define.process` disables Node environment detection in Emscripten: modern workerd exposes a process compatibility object, while this is the Cloudflare-specific PHP build. TCPDF's internal random-seed call to `uniqid()` is replaced with `random_bytes()` because workerd's frozen clock causes PHP's busy-wait to consume the CPU limit. This changes internal PDF identifiers only, not form contents, layout or template code. No JavaScript eval or remote-code loader is enabled. Only the selected PHP 8.3 Wasm module is deployed; the npm package also contains other PHP versions which are not bundled.

## Release

Deploy the original-template Worker before the main Worker that consumes it:

```sh
npm run deploy:production --prefix cloudflare
```

This builds the original archive, deploys the private renderer, builds the frontend and deploys the main production Worker. No D1 migration is required. After release verify actual protected documents and the private binding with synthetic data; never send production mail as a test. When changing a canonical PHP template, rebuild this archive and redeploy the renderer as part of the same release.

The archive contains TCPDF's LGPL license; the PHP Wasm package's licenses and version-bound manifest are distributed by its pinned npm package. TCPDF source remains in `vendor/tecnickcom/tcpdf`; PHP Wasm provenance is `cloudflare/node_modules/php-cloud-wasm/php8.3-cloudflare.manifest.json`.
