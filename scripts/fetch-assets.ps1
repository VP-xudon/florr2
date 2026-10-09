# fetch-assets.ps1
# One-shot fetch of florr.io assets DIRECTLY from the official CDN (florr.io).
# The file-name index comes from assets/manifest.json, which was collected from
# the community repo NautikalTwilight/florr.io-Resources (it mirrors the exact
# official CDN paths: /mobs/<id>.svg, /petals/<id>.svg, /static/tiles/<name>.svg).
#
# Pipeline:
#   1. gen-urls.ps1   -> .tmp/urls.txt    (curl -K config: official URL + output path)
#   2. split-urls.ps1 -> .tmp/partN.txt   (small batches so each download stays short)
#   3. curl -K each part  (sprites: mobs / petals / tile svgs, from the official CDN)
#   4. fix-placeholders.ps1 (a few legacy mob ids return HTTP 404 (an HTML error
#      page) from the official CDN -> those corrupted files are replaced with a
#      valid placeholder SVG so the game can still load)
#
# NOTE: Maps (.tmj) and the tileset (.tsj) are Cloudflare-protected on the
# official CDN (HTTP 403), so they are intentionally NOT in the download list.
# The local snapshot already present in assets/ (mirrored from the community
# repo, which itself sourced them from the official CDN) is kept as-is.
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

powershell -ExecutionPolicy Bypass -File scripts/gen-urls.ps1
powershell -ExecutionPolicy Bypass -File scripts/split-urls.ps1

$i = 0
while (Test-Path ".tmp/part$i.txt") {
    Write-Host "downloading batch $i ..."
    curl.exe -K ".tmp/part$i.txt" -A "Mozilla/5.0" -sS -m 60
    $i++
}

powershell -ExecutionPolicy Bypass -File scripts/fix-placeholders.ps1
Write-Host "Official sprite fetch complete. Maps/tileset kept from local snapshot (official 403)."
