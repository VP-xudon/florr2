# fix-placeholders.ps1
# The official florr.io CDN returns HTTP 404 (an HTML error page) for a handful
# of legacy/removed mob ids. curl wrote that HTML into the .svg file, making it
# invalid. There is no real official asset for these ids, so we replace the
# corrupted files with a valid minimal placeholder SVG so the game can load.
$fixed = 0
Get-ChildItem assets/mobs -Filter *.svg | ForEach-Object {
    $first = (Get-Content $_.FullName -First 1)
    if ($first -like '<html*') {
        $placeholder = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><rect width="256" height="256" fill="#d9d9d9"/><circle cx="128" cy="128" r="90" fill="none" stroke="#999999" stroke-width="6"/><text x="128" y="134" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#666666">N/A</text></svg>'
        Set-Content -Path $_.FullName -Value $placeholder -Encoding UTF8
        Write-Host ("fixed " + $_.Name)
        $fixed++
    }
}
Write-Host "total fixed: $fixed"
