$base = "$env:USERPROFILE\.workbuddy\binaries\node\versions"
if (Test-Path $base) {
    Get-ChildItem $base -Directory | ForEach-Object { Write-Output ("DIR: " + $_.FullName) }
    Get-ChildItem $base -Recurse -Filter node.exe -ErrorAction SilentlyContinue | ForEach-Object { Write-Output ("NODE.EXE: " + $_.FullName) }
} else {
    Write-Output "base missing"
}
