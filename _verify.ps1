$ErrorActionPreference = 'Continue'
$root = 'e:/SynthOOPDeveloping/florr2'
$port = 8825
$work = 'e:/SynthOOPDeveloping/florr2/_tmpv'
if (Test-Path $work) { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $work | Out-Null
$dom = Join-Path $work 'dom.html'; $prof = Join-Path $work 'prof'
$html = [IO.File]::ReadAllText("$root/index.html")
$probe = @'
  <script>
    (function(){
      function say(s){ var el=document.getElementById('__res'); if(!el){el=document.createElement('pre');el.id='__res';document.body.appendChild(el);} el.textContent += s+'\n'; }
      function measure(svgId){
        return fetch('assets/petals/'+svgId+'.svg').then(function(r){return r.text();}).then(function(txt){
          return new Promise(function(res){
            var out = txt.replace(/viewBox="[^"]*"/, 'viewBox="0 0 110 110"');
            var url='data:image/svg+xml,'+encodeURIComponent(out);
            var img=new Image();
            img.onload=function(){
              var c=document.createElement('canvas'); c.width=c.height=220;
              var x=c.getContext('2d'); x.drawImage(img,0,0,220,220);
              var d=x.getImageData(0,0,220,220).data;
              var minx=1e9,miny=1e9,maxx=-1,maxy=-1;
              for(var yy=0;yy<220;yy++)for(var xx=0;xx<220;xx++){if(d[(yy*220+xx)*4+3]>10){if(xx<minx)minx=xx;if(xx>maxx)maxx=xx;if(yy<miny)miny=yy;if(yy>maxy)maxy=yy;}}
              if(maxx<0){res('svg'+svgId+': EMPTY');return;}
              res('svg'+svgId+': art size '+((100*(maxx-minx)/220).toFixed(0))+'% x '+((100*(maxy-miny)/220).toFixed(0))+'%  center=('+((100*(minx+maxx)/2/220).toFixed(0))+'%,'+((100*(miny+maxy)/2/220).toFixed(0))+'%)');
            };
            img.onerror=function(){res('svg'+svgId+': IMGERR');};
            img.src=url;
          });
        });
      }
      setTimeout(function(){
        try{
          Promise.all([measure('1'),measure('2'),measure('5'),measure('6')]).then(function(r){r.forEach(say);}).catch(function(e){say('ERR '+e.message);});
        }catch(e){say('THROW:'+e.message);}
      }, 3600);
    })();
  </script>
'@
$html = $html.Replace('<head>', '<head>' + "`r`n" + $probe)
[IO.File]::WriteAllText("$root/_probeV.html", $html, (New-Object Text.UTF8Encoding($false)))
$srv = Start-Process -FilePath 'python' -ArgumentList @('-m','http.server',"$port") -WorkingDirectory $root -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$a='--headless --disable-gpu --no-sandbox --disable-dev-shm-usage --user-data-dir="'+$prof+'" --virtual-time-budget=10000 --window-size=800,600 --hide-scrollbars --dump-dom "http://127.0.0.1:'+$port+'/_probeV.html"'
$pp=Start-Process -FilePath $chrome -ArgumentList $a -WindowStyle Hidden -PassThru -RedirectStandardOutput $dom
$pp.WaitForExit(70000)|Out-Null; if(-not $pp.HasExited){$pp.Kill()}
Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue
$d=$null; for($r=0;$r-lt25;$r++){ try{ $d=[IO.File]::ReadAllText($dom); if($d){break} }catch{}; Start-Sleep -Milliseconds 300 }
if($d){ $m=[regex]::Match($d,'(?s)<pre id="__res">(.*?)</pre>'); if($m.Success){ Write-Output '=== RESULT ==='; Write-Output $m.Groups[1].Value } else { Write-Output 'no __res' } } else { Write-Output 'EMPTY' }
