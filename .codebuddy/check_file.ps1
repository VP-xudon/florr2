$p = 'c:\Users\Administrator\Downloads\beefreely.min.user.js'
$b = [IO.File]::ReadAllBytes($p)
Write-Output ("Size=" + $b.Length)
Write-Output ("FirstBytes=" + (($b[0..15] | ForEach-Object { $_.ToString('X2') }) -join ' '))
$t = [IO.File]::ReadAllText($p)
Write-Output ("HasBOM=" + ($t.Length -gt 0 -and [int][char]$t[0] -eq 65279))
$crlf = ([regex]::Matches($t, "`r`n")).Count
$lfonly = ([regex]::Matches($t, "(?<!`r)`n")).Count
$cronly = ([regex]::Matches($t, "`r(?!`n)")).Count
Write-Output ("CRLF=$crlf LFonly=$lfonly CRonly=$cronly")
Write-Output ("Tail=" + $t.Substring($t.Length - 50))
