# gen-urls.ps1 : emit a curl -K config file listing every official-CDN URL
# to download (mobs / petals / tile svgs). Maps (.tmj) and tileset (.tsj) are
# intentionally omitted because the official CDN returns 403 for them; their
# local snapshot (from the community repo, itself sourced from the official CDN)
# is kept as-is.
$Root = 'e:/SynthOOPDeveloping/florr2'
$a = (Join-Path $Root 'assets').Replace('\', '/')
$j = Get-Content (Join-Path $a 'manifest.json') | ConvertFrom-Json
$lines = @()
foreach ($f in $j.categories.mobs.files) {
    $lines += "url = `"https://florr.io/mobs/$f`""
    $lines += "output = `"$a/mobs/$f`""
}
foreach ($f in $j.categories.petals.files) {
    $lines += "url = `"https://florr.io/petals/$f`""
    $lines += "output = `"$a/petals/$f`""
}
foreach ($f in $j.categories.tiles.files) {
    if ($f -like '*.svg') {
        $lines += "url = `"https://florr.io/static/tiles/$f`""
        $lines += "output = `"$a/static/tiles/$f`""
    }
}
New-Item -ItemType Directory -Force -Path (Join-Path $Root '.tmp') | Out-Null
$lines | Set-Content (Join-Path $Root '.tmp/urls.txt') -Encoding ASCII
Write-Host "wrote $($lines.Count) lines to .tmp/urls.txt"
