$fixed = 'e:\SynthOOPDeveloping\florr2\.codebuddy\beefreely.fixed.user.js'
$target = 'c:\Users\Administrator\Downloads\beefreely.min.user.js'
Copy-Item -Path $fixed -Destination $target -Force
Write-Output ("deployed -> " + $target)
Get-Item $target | ForEach-Object { Write-Output ($_.FullName + "  " + $_.Length + " bytes") }
