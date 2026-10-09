$m = Get-ChildItem assets/mobs -Filter *.svg
$p = Get-ChildItem assets/petals -Filter *.svg
$t = Get-ChildItem assets/static/tiles -Filter *.svg
function stat($col, $name) {
    $avg = [int]($col | ForEach-Object { $_.Length } | Measure-Object -Average).Average
    $min = ($col | ForEach-Object { $_.Length } | Measure-Object -Minimum).Minimum
    $ph  = ($col | Where-Object { $_.Length -lt 200 }).Count
    Write-Host ($name + ': ' + $col.Count + ' files, avg ' + $avg + 'B, min ' + $min + 'B, placeholders(<200B)=' + $ph)
}
stat $m 'mobs'
stat $p 'petals'
stat $t 'tiles'
