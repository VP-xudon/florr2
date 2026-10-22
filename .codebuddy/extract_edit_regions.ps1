$t = [IO.File]::ReadAllText('c:\Users\Administrator\Downloads\beefreely.min.user.js')
# 1. eo/to/no declaration region
$i = $t.IndexOf('eo={img_key_url')
Write-Output "=== eo/to/no region ==="
Write-Output $t.Substring($i, 220)
# 2. nav hook region
$j = $t.IndexOf('/x/web-interface/nav')
Write-Output "=== nav hook region ==="
Write-Output $t.Substring($j - 30, 420)
# 3. playurl hook call site
$k = $t.IndexOf('/x/player/wbi/playurl?$')
if ($k -lt 0) { $k = $t.IndexOf('playurl?$') }
Write-Output "=== playurl call site (k=$k) ==="
Write-Output $t.Substring($k - 320, 700)
