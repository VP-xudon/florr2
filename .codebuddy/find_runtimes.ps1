$c = Get-Command python -ErrorAction SilentlyContinue
if ($c) { Write-Output ("PYTHON: " + $c.Source) } else { Write-Output "no python" }
$c3 = Get-Command python3 -ErrorAction SilentlyContinue
if ($c3) { Write-Output ("PYTHON3: " + $c3.Source) } else { Write-Output "no python3" }
$c2 = Get-Command cscript -ErrorAction SilentlyContinue
if ($c2) { Write-Output ("CSCRIPT: " + $c2.Source) } else { Write-Output "no cscript" }
$c4 = Get-Command deno -ErrorAction SilentlyContinue
if ($c4) { Write-Output ("DENO: " + $c4.Source) } else { Write-Output "no deno" }
# broad search for node.exe under user profile and common dirs (limited depth)
$roots = @("$env:USERPROFILE", "C:\Tools", "C:\nodejs", "$env:LOCALAPPDATA")
foreach ($r in $roots) {
    if (Test-Path $r) {
        Get-ChildItem -Path $r -Filter node.exe -Recurse -Depth 4 -ErrorAction SilentlyContinue | Select-Object -First 5 | ForEach-Object { Write-Output ("NODE?: " + $_.FullName) }
    }
}
Write-Output "search done"
