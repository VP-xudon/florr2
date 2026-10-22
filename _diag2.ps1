$ErrorActionPreference = 'Continue'
$root = 'e:/SynthOOPDeveloping/florr2'
$port = 8821
$work = 'e:/SynthOOPDeveloping/florr2/_tmpd2'
if (Test-Path $work) { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $work | Out-Null
$dom = Join-Path $work 'dom.html'; $prof = Join-Path $work 'prof'
$html = [IO.File]::ReadAllText("$root/index.html")
$probe = @'
  <script>
    (function(){
      function say(s){ var el=document.getElementById('__res'); if(!el){el=document.createElement('pre');el.id='__res';document.body.appendChild(el);} el.textContent += s+'\n'; }
      function bboxOf(cv){
        if(!cv) return 'null';
        var c=cv.getContext('2d'), w=cv.width, h=cv.height, d;
        try{ d=c.getImageData(0,0,w,h).data; }catch(e){ return 'tainted'; }
        var minX=1e9,minY=1e9,maxX=-1,maxY=-1;
        for(var y=0;y<h;y++){ for(var x=0;x<w;x++){ if(d[(y*w+x)*4+3]>40){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; } } }
        if(maxX<0) return 'empty';
        return 'x'+minX+'-'+maxX+' ('+(100*(maxX-minX+1)/w).toFixed(0)+'%) y'+minY+'-'+maxY+' ('+(100*(maxY-minY+1)/h).toFixed(0)+'%)';
      }
      setTimeout(function(){
        try{
          say('typeof PETAL_METRICS='+(typeof window.PETAL_METRICS));
          if(window.PETAL_METRICS){
            say('keys sample='+Object.keys(window.PETAL_METRICS).slice(0,6).join(',')+' total='+Object.keys(window.PETAL_METRICS).length);
            say('M6='+JSON.stringify(window.PETAL_METRICS['6']));
            say('M1='+JSON.stringify(window.PETAL_METRICS['1']));
          }
          var c6=CardRenderer.artCanvas('6',128);
          say('artCanvas(6,128) content='+bboxOf(c6));
          var c1=CardRenderer.artCanvas('1',128);
          say('artCanvas(1,128) content='+bboxOf(c1));
        }catch(e){ say('THROW:'+e.message+' | '+(e.stack||'').split('\n')[1]); }
      }, 3400);
    })();
  </script>
'@
$html = $html.Replace('<head>', '<head>' + "`r`n" + $probe)
[IO.File]::WriteAllText("$root/_probeD2.html", $html, (New-Object Text.UTF8Encoding($false)))
$srv = Start-Process -FilePath 'python' -ArgumentList @('-m','http.server',"$port") -WorkingDirectory $root -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$a='--headless --disable-gpu --no-sandbox --disable-dev-shm-usage --user-data-dir="'+$prof+'" --virtual-time-budget=9000 --window-size=800,600 --hide-scrollbars --dump-dom "http://127.0.0.1:'+$port+'/_probeD2.html"'
$pp=Start-Process -FilePath $chrome -ArgumentList $a -WindowStyle Hidden -PassThru -RedirectStandardOutput $dom
$pp.WaitForExit(70000)|Out-Null; if(-not $pp.HasExited){$pp.Kill()}
Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue
$d=$null; for($r=0;$r-lt25;$r++){ try{ $d=[IO.File]::ReadAllText($dom); if($d){break} }catch{}; Start-Sleep -Milliseconds 300 }
if($d){ $m=[regex]::Match($d,'(?s)<pre id="__res">(.*?)</pre>'); if($m.Success){ Write-Output '=== RESULT ==='; Write-Output $m.Groups[1].Value } else { Write-Output 'no __res' } } else { Write-Output 'EMPTY' }
