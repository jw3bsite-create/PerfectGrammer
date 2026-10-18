# Legt die Desktop-Verknuepfung "Wegwerf-ID" an. Sie oeffnet das Tool in einem eigenen App-Fenster.
# Aufruf in PowerShell (eine Zeile):
#   irm https://raw.githubusercontent.com/jw3bsite-create/PerfectGrammer/claude/elegant-hypatia-dgbvon/windows/wegwerf-id-verknuepfung.ps1 | iex
# Bewusst nur ASCII-Zeichen: Der Text wird direkt ausgefuehrt, ohne Datei.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

$Url = 'https://claude.ai/artifact/CgwgZteHFJGnZvkZJy8Uof'
$Raw = 'https://raw.githubusercontent.com/jw3bsite-create/PerfectGrammer/claude/elegant-hypatia-dgbvon/windows'
$Base = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Wegwerf-ID'
New-Item -ItemType Directory -Force -Path $Base | Out-Null

Write-Host 'Symbol wird geladen ...'
$Icon = Join-Path $Base 'wegwerf-id.ico'
Invoke-WebRequest -Uri "$Raw/wegwerf-id.ico" -OutFile $Icon -UseBasicParsing

# Standardbrowser ermitteln: Chrome und Edge koennen die Seite als App-Fenster ohne Leisten oeffnen.
$progId = ''
try {
  $progId = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice' -ErrorAction Stop).ProgId
} catch { }

function Find-Exe($paths) {
  foreach ($p in $paths) { if ($p -and (Test-Path $p)) { return $p } }
  return $null
}
$chrome = Find-Exe @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
$edge = Find-Exe @(
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
)

$browser = $null
if ($progId -like 'ChromeHTML*' -and $chrome) { $browser = $chrome }
elseif ($progId -like 'MSEdgeHTM*' -and $edge) { $browser = $edge }

$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'Wegwerf-ID.lnk'
$urlPath = Join-Path $desktop 'Wegwerf-ID.url'
foreach ($old in @($lnkPath, $urlPath)) { if (Test-Path $old) { Remove-Item -Path $old -Force } }

if ($browser) {
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut($lnkPath)
  $link.TargetPath = $browser
  $link.Arguments = "--app=$Url --window-size=1120,940"
  $link.WorkingDirectory = Split-Path $browser
  $link.IconLocation = $Icon
  $link.Description = 'Wegwerf-ID: ausgedachte Angaben fuer Anmeldeformulare'
  $link.Save()
  $how = 'als eigenes App-Fenster'
  $start = { Start-Process -FilePath $browser -ArgumentList "--app=$Url --window-size=1120,940" }
} else {
  # Anderer Standardbrowser (z. B. Firefox): normale Internet-Verknuepfung mit eigenem Symbol
  $lines = @('[InternetShortcut]', "URL=$Url", "IconFile=$Icon", 'IconIndex=0')
  Set-Content -Path $urlPath -Value $lines -Encoding ASCII
  $how = 'in deinem Standardbrowser'
  $start = { Start-Process $Url }
}

Write-Host ''
Write-Host 'Fertig: Auf dem Desktop liegt die Verknuepfung "Wegwerf-ID".' -ForegroundColor Green
Write-Host "Sie oeffnet das Tool $how. Melde dich dort bei claude.ai an, falls noetig."
Write-Host ''
& $start
