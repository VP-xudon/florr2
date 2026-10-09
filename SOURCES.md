# Asset Sources & Provenance

All game assets under `assets/` are sourced from the **official florr.io CDN**
(`florr.io`, by M28 Games LLC). This project mirrors the official CDN directory
layout so a reimplemented client can reference assets exactly as the original
game does.

## How sprites were obtained (official, direct)

Sprites (mobs / petals / tile svgs) were downloaded **directly from the official
CDN** at the paths documented by the community mirror
[NautikalTwilight/florr.io-Resources](https://github.com/NautikalTwilight/florr.io-Resources)
(`endpoints.txt`):

| Category | Official URL pattern                         | Local path                |
|----------|---------------------------------------------|---------------------------|
| Mobs     | `https://florr.io/mobs/<id>.svg`            | `assets/mobs/<id>.svg`    |
| Petals   | `https://florr.io/petals/<id>.svg`          | `assets/petals/<id>.svg`  |
| Tiles    | `https://florr.io/static/tiles/<name>.svg`  | `assets/static/tiles/...` |

The file-name index used for the download lives in `assets/manifest.json`
(also collected from the community mirror).

### Reproduce

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fetch-assets.ps1
```

This: builds the URL list (`gen-urls.ps1`), splits it into short batches
(`split-urls.ps1`), downloads each batch with `curl -K` from the official CDN,
then runs `fix-placeholders.ps1`.

## Maps & tileset (official CDN is 403-protected)

`assets/static/maps/*.tmj` and `assets/static/tiles/*.tsj` **cannot** be fetched
from the official CDN directly — it returns HTTP 403 (Cloudflare protection) for
those paths even with a browser User-Agent and Referer.

For these, we keep the **local snapshot** already present in `assets/`, which was
mirrored from the community repo `florr.io-Resources` (itself sourced from the
official CDN). In other words: the maps/tileset are official assets delivered
via the community mirror because the live CDN blocks direct download.

| Category | Local path                      | Count |
|----------|---------------------------------|-------|
| Maps     | `assets/static/maps/*.tmj`      | 22    |
| Tileset  | `assets/static/tiles/*.tsj`     | 2     |

## Known missing assets (placeholder)

A handful of legacy/removed mob ids (e.g. `13, 15, 17, 35, 57, 60, 62, 64, 66,
69`) return **HTTP 404** from the official CDN — there is no real asset for them
on the live game either. Their files contain a valid minimal placeholder SVG
(gray circle + "N/A") so the engine can load without crashing. They are not
real artwork and may be replaced if the upstream game ever serves them.

## Inventory

`assets/manifest.json` records the full inventory (counts + file lists per
category, plus `generated` timestamp). Current totals:

- mobs: 83 svg
- petals: 116 svg
- tiles: 129 svg + 2 tsj
- maps: 22 tmj

## Attribution

- Game & assets: florr.io by M28 Games LLC.
- File-name index / community mirror:
  [NautikalTwilight/florr.io-Resources](https://github.com/NautikalTwilight/florr.io-Resources)
  (used only as a directory index; sprite bytes come from the official CDN).
