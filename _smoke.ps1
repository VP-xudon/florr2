$ErrorActionPreference = 'Continue'
$root = 'e:/SynthOOPDeveloping/florr2'
$port = 8827
$work = 'e:/SynthOOPDeveloping/florr2/_tmps'
if (Test-Path $work) { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $work | Out-Null
$dom = Join-Path $work 'dom.html'; $prof = Join-Path $work 'prof'
$html = [IO.File]::ReadAllText("$root/index.html")
$probe = @'
  <script>
    (function(){
      function say(s){ var el=document.getElementById('__res'); if(!el){el=document.createElement('pre');el.id='__res';document.body.appendChild(el);} el.textContent += s+'\n'; }
      window.__errs=[]; window.addEventListener('error',function(e){ window.__errs.push((e.message||'')+' @ '+(e.filename||'')+':'+e.lineno); });
      setTimeout(function(){
        try{
          say('CardRenderer.createCard='+(typeof CardRenderer.createCard));
          say('SpriteStore.ready(petal6)='+SpriteStore.ready('petal6'));
          var c = CardRenderer.createCard({ svg:'6', rarity:'common', count:1 });
          say('createCard ok='+(!!c)+' isCanvas='+(c&&c.tagName==='CANVAS'));
          setTimeout(function(){
            try{
              say('card.img set='+!!(c && c._card && c._card.img));
              say('card.name='+(c&&c._card&&c._card.name));
              say('SpriteStore.ready(petal6) now='+SpriteStore.ready('petal6'));
              say('errors='+(window.__errs.length?JSON.stringify(window.__errs):'none'));
            }catch(e){ say('INNER THROW:'+e.message); }
          }, 2500);
        }catch(e){ say('THROW:'+e.message); }
      }, 3200);
    })();
  </script>
'@
$html = $html.Replace('<head>', '<head>' + "`r`n" + $probe)
[IO.File]::WriteAllText("$root/_probeS.html", $html, (New-Object Text.UTF8Encoding($false)))
$srv = Start-Process -FilePath 'python' -ArgumentList @('-m','http.server',"$port") -WorkingDirectory $root -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$a='--headless --disable-gpu --no-sandbox --disable-dev-shm-usage --user-data-dir="'+$prof+'" --virtual-time-budget=10000 --window-size=800,600 --hide-scrollbars --dump-dom "http://127.0.0.1:'+$port+'/_probeS.html"'
$pp=Start-Process -FilePath $chrome -ArgumentList $a -WindowStyle Hidden -PassThru -RedirectStandardOutput $dom
$pp.WaitForExit(70000)|Out-Null; if(-not $pp.HasExited){$pp.Kill()}
Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue
$d=$null; for($r=0;$r-lt25;$r++){ try{ $d=[IO.File]::ReadAllText($dom); if($d){break} }catch{}; Start-Sleep -Milliseconds 300 }
if($d){ $m=[regex]::Match($d,'(?s)<pre id="__res">(.*?)</pre>'); if($m.Success){ Write-Output '=== RESULT ==='; Write-Output $m.Groups[1].Value } else { Write-Output 'no __res' } } else { Write-Output 'EMPTY' }
