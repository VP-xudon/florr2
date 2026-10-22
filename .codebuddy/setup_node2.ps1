$src = "$env:USERPROFILE\.workbuddy\binaries\node\versions\22.12.0.installing.10456.__extract_temp__\node-v22.12.0-win-x64"
$dst = "E:\SynthOOPDeveloping\florr2\.codebuddy\node"
if (-not (Test-Path "$dst\node.exe")) {
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Copy-Item -Path "$src\*" -Destination $dst -Recurse -Force
    Write-Output "node restored"
} else { Write-Output "node already present" }
