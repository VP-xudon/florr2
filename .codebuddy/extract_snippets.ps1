$t = [IO.File]::ReadAllText('c:\Users\Administrator\Downloads\beefreely.min.user.js')
function Show-Context($text, $needle, $before, $after) {
    $idx = 0
    while (($idx = $text.IndexOf($needle, $idx)) -ge 0) {
        $start = [Math]::Max(0, $idx - $before)
        $len = [Math]::Min($text.Length - $start, $before + $after)
        Write-Output ("--- match of '$needle' @ $idx ---")
        Write-Output $text.Substring($start, $len)
        Write-Output ""
        $idx += $needle.Length
    }
}
Show-Context $t 'img_key_url' 80 120
Show-Context $t 'sub_key_url' 80 120
Show-Context $t 'w_rid' 150 50
