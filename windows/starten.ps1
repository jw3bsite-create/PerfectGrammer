# Startet Sprachrichtigkeit und holt vorher automatisch die neueste Version von GitHub.
# Wird über die Verknüpfung „Sprachrichtigkeit“ auf dem Desktop aufgerufen (siehe einrichten.ps1).
# Die Lerndaten liegen im Browser unter http://localhost:5173 und bleiben bei jedem Update erhalten.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Repo = 'jw3bsite-create/PerfectGrammer'
$Branch = 'claude/sprachrichtigkeit-app-xzd9cl'
$Port = 5173
$Base = if ($env:SPRACHRICHTIGKEIT_HOME) { $env:SPRACHRICHTIGKEIT_HOME } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Sprachrichtigkeit' }
$App = Join-Path $Base 'app'
$VersionFile = Join-Path $Base 'version.txt'
# Zeitstempel: Wurde die App für ein Update beendet, schließt sich ihr altes Fenster ohne Fehlermeldung.
$RestartFile = Join-Path $Base 'neustart.txt'
$Npm = if ($env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }

try { $Host.UI.RawUI.WindowTitle = 'Sprachrichtigkeit' } catch { }
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

function Stop-WithMessage([string]$Text) {
  Write-Host ''
  Write-Host $Text -ForegroundColor Red
  Write-Host ''
  Read-Host 'Enter drücken zum Schließen'
  exit 1
}

# Node lauscht unter Windows oft nur auf der IPv6-Adresse von localhost, deshalb beide prüfen.
function Test-PortInUse {
  foreach ($addr in @('127.0.0.1', '::1')) {
    try {
      $client = New-Object Net.Sockets.TcpClient($addr, $Port)
      $client.Close()
      return $true
    } catch { }
  }
  return $false
}

# Beendet die laufende App: den Node-Prozess am Port und darüber npm und das alte Fenster,
# damit nichts mehr den App-Ordner sperrt.
function Stop-RunningApp {
  $ids = @()
  try { $ids = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique) } catch { }
  if (-not $ids.Count) {
    try {
      foreach ($line in (netstat -ano | Select-String -Pattern ":$Port\s+\S+\s+LISTENING")) {
        $ids += [int](($line.ToString().Trim() -split '\s+')[-1])
      }
    } catch { }
  }
  foreach ($start in ($ids | Select-Object -Unique)) {
    $proc = Get-Process -Id $start -ErrorAction SilentlyContinue
    if (-not $proc -or $proc.ProcessName -ne 'node') { continue }
    # Kette nach oben: node ← cmd ← node (npm) ← cmd (npm.cmd) ← powershell (altes Fenster)
    $kette = @()
    $id = [int]$start
    for ($n = 0; $n -lt 8 -and $id -and $id -ne $PID; $n++) {
      $w = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
      if (-not $w) { break }
      $name = [IO.Path]::GetFileNameWithoutExtension([string]$w.Name).ToLower()
      if (@('node', 'cmd', 'powershell', 'pwsh') -notcontains $name) { break }
      $kette += $id
      if ($name -eq 'powershell' -or $name -eq 'pwsh') { break }
      $id = [int]$w.ParentProcessId
    }
    if (-not $kette.Count) { $kette = @([int]$start) }
    foreach ($k in $kette) { Stop-Process -Id $k -Force -ErrorAction SilentlyContinue }
  }
}

# Verschiebt einen Ordner; ist er kurz gesperrt (eben beendete App), mehrmals neu versuchen.
function Move-WithRetry([string]$From, [string]$To) {
  for ($n = 1; ; $n++) {
    try { Move-Item -Path $From -Destination $To -ErrorAction Stop; return }
    catch { if ($n -ge 10) { throw }; Start-Sleep -Seconds 1 }
  }
}

Write-Host ''
Write-Host '  Sprachrichtigkeit' -ForegroundColor Cyan
Write-Host ''

# Neueste Version auf GitHub abfragen
$latest = $null
Write-Host 'Suche nach Updates …'
try {
  $info = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/commits/$Branch" -Headers @{ 'User-Agent' = 'Sprachrichtigkeit' } -TimeoutSec 20
  $latest = [string]$info.sha
} catch {
  Write-Host 'Keine Verbindung zu GitHub. Die vorhandene Version wird gestartet.' -ForegroundColor Yellow
}

$current = ''
if (Test-Path $VersionFile) { $current = (Get-Content $VersionFile -Raw).Trim() }

# Läuft die App schon (zweites Fenster): ohne Update nur den Browser öffnen.
if (Test-PortInUse) {
  if (-not $latest -or $latest -eq $current) {
    Write-Host 'Die App läuft bereits und ist auf dem neuesten Stand. Der Browser wird geöffnet.'
    try { Start-Process "http://localhost:$Port/" } catch { Write-Host "Bitte im Browser http://localhost:$Port öffnen." }
    Start-Sleep -Seconds 2
    exit 0
  }
  # Neue Version, aber die alte läuft noch: alte beenden, dann wie gewohnt aktualisieren und neu starten.
  Write-Host 'Neue Version gefunden. Die laufende App wird dafür beendet …' -ForegroundColor Green
  Set-Content -Path $RestartFile -Value ([DateTime]::UtcNow.ToString('o'))
  Stop-RunningApp
  for ($i = 0; $i -lt 20 -and (Test-PortInUse); $i++) { Start-Sleep -Milliseconds 500 }
  if (Test-PortInUse) {
    Stop-WithMessage 'Die laufende App ließ sich nicht beenden. Bitte das andere schwarze Fenster „Sprachrichtigkeit“ schließen und die Verknüpfung erneut starten.'
  }
  Start-Sleep -Seconds 1
}

if (-not (Get-Command $Npm -ErrorAction SilentlyContinue)) {
  Stop-WithMessage 'Node.js wurde nicht gefunden. Bitte von https://nodejs.org die Version „LTS“ installieren und danach erneut starten.'
}

New-Item -ItemType Directory -Force -Path $Base | Out-Null

$installed = Test-Path (Join-Path $App 'package.json')

if ($latest -and ($latest -ne $current -or -not $installed)) {
  if ($installed) { Write-Host 'Neue Version gefunden. Sie wird geladen …' -ForegroundColor Green }
  else { Write-Host 'Die App wird zum ersten Mal eingerichtet. Das dauert ein bis zwei Minuten …' -ForegroundColor Green }

  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('sprachrichtigkeit-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  try {
    $zip = Join-Path $tmp 'app.zip'
    Invoke-WebRequest -Uri "https://codeload.github.com/$Repo/zip/$latest" -OutFile $zip -UseBasicParsing -TimeoutSec 120
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $src = Get-ChildItem -Path $tmp -Directory | Select-Object -First 1
    if (-not $src -or -not (Test-Path (Join-Path $src.FullName 'package.json'))) { throw 'Das heruntergeladene Archiv ist unvollständig.' }

    # Alte Version erst beiseitelegen: Ist sie gesperrt, scheitert schon dieser Schritt und nichts ist verändert.
    $alt = "$App.alt"
    if (Test-Path $alt) { Remove-Item -Path $alt -Recurse -Force }
    if (Test-Path $App) { Move-WithRetry $App $alt }
    try {
      # Installierte Pakete mitnehmen, damit „npm install“ schnell bleibt.
      if (Test-Path (Join-Path $alt 'node_modules')) { Move-Item -Path (Join-Path $alt 'node_modules') -Destination (Join-Path $src.FullName 'node_modules') }
      Move-Item -Path $src.FullName -Destination $App
    } catch {
      # Alles zurückstellen
      if ((Test-Path (Join-Path $src.FullName 'node_modules')) -and (Test-Path $alt)) { Move-Item -Path (Join-Path $src.FullName 'node_modules') -Destination (Join-Path $alt 'node_modules') }
      if ((-not (Test-Path $App)) -and (Test-Path $alt)) { Move-Item -Path $alt -Destination $App }
      throw
    }
    if (Test-Path $alt) { Remove-Item -Path $alt -Recurse -Force -ErrorAction SilentlyContinue }
  } catch {
    if (Test-Path $tmp) { Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue }
    if (-not (Test-Path (Join-Path $App 'package.json'))) { Stop-WithMessage "Das Update konnte nicht geladen werden: $($_.Exception.Message)" }
    Write-Host "Das Update konnte nicht geladen werden ($($_.Exception.Message)). Die vorhandene Version wird gestartet." -ForegroundColor Yellow
    $latest = $null
  }
  if (Test-Path $tmp) { Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue }

  if ($latest) {
    Write-Host 'Pakete werden installiert …'
    Push-Location $App
    & $Npm install --no-audit --no-fund
    $ok = ($LASTEXITCODE -eq 0)
    Pop-Location
    if (-not $ok) { Stop-WithMessage 'Die Installation ist fehlgeschlagen. Beim nächsten Start wird es erneut versucht.' }
    Set-Content -Path $VersionFile -Value $latest

    # Startskript und Symbol selbst aktuell halten (gilt ab dem nächsten Start).
    foreach ($f in @('starten.ps1', 'sprachrichtigkeit.ico')) {
      $neu = Join-Path $App (Join-Path 'windows' $f)
      if (Test-Path $neu) { Copy-Item -Path $neu -Destination (Join-Path $Base $f) -Force }
    }
    Write-Host 'Update abgeschlossen.' -ForegroundColor Green
  }
} elseif ($latest) {
  Write-Host 'Die App ist auf dem neuesten Stand.'
}

if (-not (Test-Path (Join-Path $App 'package.json'))) {
  Stop-WithMessage 'Die App ist noch nicht installiert. Für den ersten Start wird eine Internetverbindung gebraucht.'
}

# Selbstreparatur: Fehlen die Pakete (etwa nach einem abgebrochenen Update), neu installieren.
if (-not (Test-Path (Join-Path $App 'node_modules\vite'))) {
  Write-Host 'Pakete fehlen und werden installiert …' -ForegroundColor Yellow
  Push-Location $App
  & $Npm install --no-audit --no-fund
  $ok = ($LASTEXITCODE -eq 0)
  Pop-Location
  if (-not $ok) { Stop-WithMessage 'Die Installation ist fehlgeschlagen. Bitte die Internetverbindung prüfen und erneut starten.' }
}

if ($env:SPRACHRICHTIGKEIT_NUR_UPDATE) { exit 0 }

Write-Host ''
Write-Host 'Die App öffnet sich gleich im Browser.' -ForegroundColor Cyan
Write-Host 'Dieses Fenster offen lassen, solange du lernst. Zum Beenden einfach schließen.'
Write-Host ''
Set-Location $App
& $Npm run dev -- --open --port $Port --strictPort
if ($LASTEXITCODE -ne 0) {
  $fuerUpdate = $false
  if (Test-Path $RestartFile) {
    try { $fuerUpdate = ([DateTime]::UtcNow - [DateTime]::Parse((Get-Content $RestartFile -Raw).Trim()).ToUniversalTime()).TotalMinutes -lt 3 } catch { }
  }
  if ($fuerUpdate) { exit 0 }
  Stop-WithMessage 'Die App wurde mit einem Fehler beendet. Die Meldung steht oben.'
}
