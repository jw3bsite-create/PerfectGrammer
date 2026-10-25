# Legt die Desktop-Verknuepfung "PerfectGrammar" neu an und erzwingt die neueste Version.
# Aufruf in PowerShell (eine Zeile):
#   irm https://raw.githubusercontent.com/jw3bsite-create/PerfectGrammer/claude/sprachrichtigkeit-app-xzd9cl/windows/einrichten-online.ps1 | iex
# Bewusst nur ASCII-Zeichen: Der Text wird direkt ausgefuehrt, ohne Datei.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

$Raw = 'https://raw.githubusercontent.com/jw3bsite-create/PerfectGrammer/claude/sprachrichtigkeit-app-xzd9cl/windows'
$Base = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Sprachrichtigkeit'
New-Item -ItemType Directory -Force -Path $Base | Out-Null

Write-Host 'Startskript wird geladen ...'
Invoke-WebRequest -Uri "$Raw/starten.ps1" -OutFile (Join-Path $Base 'starten.ps1') -UseBasicParsing
Invoke-WebRequest -Uri "$Raw/sprachrichtigkeit.ico" -OutFile (Join-Path $Base 'sprachrichtigkeit.ico') -UseBasicParsing

# Gespeicherte Versionsnummer loeschen: Der naechste Start laedt die neueste Version sicher neu.
$VersionFile = Join-Path $Base 'version.txt'
if (Test-Path $VersionFile) { Remove-Item -Path $VersionFile -Force }

$desktop = [Environment]::GetFolderPath('Desktop')
$oldLnk = Join-Path $desktop 'Sprachrichtigkeit.lnk'
if (Test-Path $oldLnk) { Remove-Item -Path $oldLnk -Force }
$lnkPath = Join-Path $desktop 'PerfectGrammar.lnk'
if (Test-Path $lnkPath) { Remove-Item -Path $lnkPath -Force }
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($lnkPath)
$link.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$link.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $Base 'starten.ps1')`""
$link.WorkingDirectory = $Base
$link.IconLocation = Join-Path $Base 'sprachrichtigkeit.ico'
$link.Description = 'PerfectGrammar starten (aktualisiert sich selbst)'
$link.Save()

Write-Host ''
Write-Host 'Fertig: Auf dem Desktop liegt die neue Verknuepfung "PerfectGrammar".' -ForegroundColor Green
Write-Host 'Die App wird jetzt aktualisiert und gestartet ...'
Write-Host ''
Start-Process -FilePath $link.TargetPath -ArgumentList $link.Arguments -WorkingDirectory $Base
