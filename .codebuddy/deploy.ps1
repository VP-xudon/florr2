$orig = 'c:\Users\Administrator\Downloads\beefreely.min.user.js'
$fixed = 'e:\SynthOOPDeveloping\florr2\.codebuddy\beefreely.fixed.user.js'
$bak = 'c:\Users\Administrator\Downloads\beefreely.min.user.js.bak'
Copy-Item -Path $orig -Destination $bak -Force
Copy-Item -Path $fixed -Destination $orig -Force
Write-Output ("backup -> " + $bak)
Write-Output ("fixed  -> " + $orig)
Get-Item $orig, $bak | ForEach-Object { Write-Output ($_.FullName + "  " + $_.Length + " bytes") }
