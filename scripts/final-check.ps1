$bad = 0
Get-ChildItem assets -Recurse -Include *.svg,*.tmj,*.tsj | ForEach-Object {
    $first = (Get-Content $_.FullName -First 1)
    if ($first -like '<html*') { Write-Host ('HTML: ' + $_.FullName); $bad++ }
}
$m = (Get-ChildItem assets/mobs -Filter *.svg).Count
$p = (Get-ChildItem assets/petals -Filter *.svg).Count
$t = (Get-ChildItem assets/static/tiles -Filter *.svg).Count
$tsj = (Get-ChildItem assets/static/tiles -Filter *.tsj).Count
$mp = (Get-ChildItem assets/static/maps -Filter *.tmj).Count
Write-Host "mobs=$m petals=$p tiles(svg)=$t tiles(tsj)=$tsj maps=$mp"
Write-Host "HTML-contaminated files: $bad"
