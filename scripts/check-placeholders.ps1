function head($dir) {
    Get-ChildItem $dir -Filter *.svg | Where-Object { $_.Length -lt 200 } | ForEach-Object {
        $first = (Get-Content $_.FullName -First 1)
        $snip = $first.Substring(0, [Math]::Min(70, $first.Length))
        Write-Host ($_.Name + ' (' + $_.Length + 'B) -> ' + $snip)
    }
}
Write-Host '=== mobs placeholders ==='
head 'assets/mobs'
Write-Host '=== tiles placeholders ==='
head 'assets/static/tiles'
