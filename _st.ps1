$ErrorActionPreference = 'Continue'
$root = 'e:/SynthOOPDeveloping/florr2'
$port = 8820
$work = 'e:/SynthOOPDeveloping/florr2/_tmpshot'
if (Test-Path $work) { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $work | Out-Null
$dom = Join-Path $work 'dom.html'; $prof = Join-Path $work 'prof'
$html = [IO.File]::ReadAllText("$root/index.html")
$probe = @'
  <script>
    (function(){
      function say(s){ var el=document.getElementById('__res'); if(!el){el=document.createElement('pre');el.id='__res';document.body.appendChild(el);} el.textContent += s+'\n'; }
      // 把两张卡(6=Stinger, 1=Basic)渲染到页面，便于截图对比
      function showCard(svg, label){
        try{
          var c = CardRenderer.createCard({ svg: svg, rarity: 'common', count: 1 });
          c.style.cssText = 'position:absolute;left:10px;top:'+(label==='basic'?10:230)+'px;width:160px;height:160px;background:#222;border:2px solid #555;';
          c._label = label;
          document.body.appendChild(c);
        }catch(e){ say('card '+svg+' err:'+e.message); }
      }
      setTimeout(function(){
        try{
          showCard('6','stinger');
          showCard('1','basic');
          say('cards created. waiting for paint...');
        }catch(e){ say('THROW:'+e.message); }
      }, 3200);
    })();
  </script>
'@
$html = $html.Replace('<head>', '<head>' + "`r`n" + $probe)
[IO.File]::WriteAllText("$root/_probeSt.html", $html, (New-Object Text.UTF8Encoding($false)))
$srv = Start-Process -FilePath 'python' -ArgumentList @('-m','http.server',"$port") -WorkingDirectory $root -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$a='--headless --disable-gpu --no-sandbox --disable-dev-shm-usage --user-data-dir="'+$prof+'" --virtual-time-budget=8000 --window-size=400,420 --hide-scrollbars --screenshot="e:/SynthOOPDeveloping/florr2/_stinger_card.png" "http://127.0.0.1:'+$port+'/_probeSt.html"'
$pp=Start-Process -FilePath $chrome -ArgumentList $a -WindowStyle Hidden -PassThru -RedirectStandardOutput $dom
$pp.WaitForExit(70000)|Out-Null; if(-not $pp.HasExited){$pp.Kill()}
Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue
$d=$null; for($r=0;$r-lt25;$r++){ try{ $d=[IO.File]::ReadAllText($dom); if($d){break} }catch{}; Start-Sleep -Milliseconds 300 }
if($d){ $m=[regex]::Match($d,'(?s)<pre id="__res">(.*?)</pre>'); if($m.Success){ Write-Output '=== RESULT ==='; Write-Output $m.Groups[1].Value } else { Write-Output 'no __res' } } else { Write-Output 'EMPTY' }
