$paths = @(
    'C:\Program Files\nodejs\node.exe',
    'C:\Program Files (x86)\nodejs\node.exe',
    "$env:ProgramFiles\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
    "$env:APPDATA\npm\node.exe"
)
foreach ($p in $paths) {
    if (Test-Path $p) { Write-Output ("FOUND: " + $p) }
}
Get-Item "$env:USERPROFILE\.workbuddy\binaries\node\versions\*\node.exe" -ErrorAction SilentlyContinue | ForEach-Object { Write-Output ("FOUND: " + $_.FullName) }
$c = Get-Command node -ErrorAction SilentlyContinue
if ($c) { Write-Output ("ON PATH: " + $c.Source) } else { Write-Output "node NOT on PATH" }
