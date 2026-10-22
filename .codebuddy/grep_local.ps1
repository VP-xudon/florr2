$t = [IO.File]::ReadAllText('c:\Users\Administrator\Downloads\beefreely.min.user.js')
foreach ($needle in @('setItem', 'wbi_img', 'localStorage', '__INITIAL_STATE__', 'unsafeWindow', 'GM_', 'queueMicrotask')) {
    $idx = 0
    $count = 0
    while (($idx = $t.IndexOf($needle, $idx)) -ge 0) {
        $count++
        $idx += $needle.Length
    }
    Write-Output ("'{0}' occurrences: {1}" -f $needle, $count)
}
# show context of each setItem / localStorage usage
$idx = 0
while (($idx = $t.IndexOf('localStorage', $idx)) -ge 0) {
    $start = [Math]::Max(0, $idx - 120)
    $len = [Math]::Min($t.Length - $start, 240)
    Write-Output "--- localStorage @ $idx ---"
    Write-Output $t.Substring($start, $len)
    $idx += 11
}
