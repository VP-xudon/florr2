# split-urls.ps1 : split .tmp/urls.txt (curl -K format, 2 lines per asset)
# into smaller .tmp/partN.txt batches so each can be downloaded by a short,
# non-blocking curl command.
$p = Get-Content .tmp/urls.txt -Encoding UTF8
$c = 110
$n = 0
for ($i = 0; $i -lt $p.Count; $i += $c) {
    $end = [math]::Min($i + $c - 1, $p.Count - 1)
    $p[$i..$end] | Set-Content -Encoding ASCII ".tmp/part$n.txt"
    $n++
}
Write-Host "split into $n parts"
Get-ChildItem .tmp/part*.txt | Select-Object Name, Length
