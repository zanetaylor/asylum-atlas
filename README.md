# Asylum Atlas

Asylum Atlas is a static Astro prototype mapping verified former and surviving U.S. sites associated with the Kirkbride Plan. WIP.

## Development

- Node 20+ and pnpm 11+ are recommended.
- `pnpm install` installs dependencies.
- `pnpm dev` starts the local Astro server.
- `pnpm validate` checks site/source/image JSON before a build.
- `pnpm check` runs Astro and TypeScript diagnostics.
- `pnpm build` validates data and creates the static `dist/` site.
- `pnpm test` runs unit tests.
- `pnpm preview:worker` builds the site and serves it with Wrangler locally.
- `pnpm deploy` builds the site and deploys `dist/` as Cloudflare Worker static assets. Authenticate first with `pnpm exec wrangler login`.

The map uses MapLibre GL and OpenFreeMap’s public style at runtime. The searchable result list remains useful if WebGL or the basemap is unavailable, and the full site record is shown in the map detail panel. Set `PUBLIC_MAP_STYLE_URL` to replace the style endpoint.

## Data and research rules

Structured data lives in `src/data/sites.json`, `src/data/sources.json`, and `src/data/images.json`. Add a stable site ID and slug, cite the record, label coordinate precision, and leave uncertain fields `null` or `unknown`. Do not copy source prose. The validator rejects invalid coordinates, dates, statuses, duplicate IDs, broken citations, unsupported image licenses, and missing local image files.

Images belong in `public/` and must include complete metadata in `images.json`: original URL, creator, description/alt text, license URL, and visible attribution. Accepted licenses are Public Domain, CC0, CC BY, and CC BY-SA. A small number of historically useful leads may be included with `Rights status unclear`; these are not cleared for publication and require rights confirmation before deployment.

## Sources

The initial discovery inventory used:

- [Kirkbride Buildings](http://www.kirkbridebuildings.com/)
- [Historic Asylums](https://sites.rootsweb.com/~asylums/index.html060300)
- [Asylum Projects](https://asylumprojects.org/)

Published records also reference National Park Service / National Register material, the Library of Congress, state preservation offices, state agencies, institutional archives, and historical encyclopedias. See the in-site [sources page](https://asylum-atlas.example/sources/) and the local source manifest for the full list.

## Note

This is an informational historical directory, not an access guide, and is not affiliated with listed institutions or source sites.
