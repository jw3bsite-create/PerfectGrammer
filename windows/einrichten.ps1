# Richtet PerfectGrammar einmalig ein:
# kopiert das Startskript nach %USERPROFILE%\Sprachrichtigkeit, legt die Verknüpfung „PerfectGrammar“
# auf dem Desktop an und startet die App. Danach aktualisiert sie sich bei jedem Start selbst.

$ErrorActionPreference = 'Stop'

$Base = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Sprachrichtigkeit'
New-Item -ItemType Directory -Force -Path $Base | Out-Null
Copy-Item -Path (Join-Path $PSScriptRoot 'starten.ps1') -Destination $Base -Force
Copy-Item -Path (Join-Path $PSScriptRoot 'sprachrichtigkeit.ico') -Destination $Base -Force

# Gespeicherte Versionsnummer löschen: Der Start lädt dann sicher die neueste Version.
$VersionFile = Join-Path $Base 'version.txt'
if (Test-Path $VersionFile) { Remove-Item -Path $VersionFile -Force }

$desktop = [Environment]::GetFolderPath('Desktop')
$oldLnk = Join-Path $desktop 'Sprachrichtigkeit.lnk'
if (Test-Path $oldLnk) { Remove-Item -Path $oldLnk -Force }
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut((Join-Path $desktop 'PerfectGrammar.lnk'))
$link.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$link.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $Base 'starten.ps1')`""
$link.WorkingDirectory = $Base
$link.IconLocation = Join-Path $Base 'sprachrichtigkeit.ico'
$link.Description = 'PerfectGrammar starten (aktualisiert sich selbst)'
$link.Save()

Write-Host ''
Write-Host 'Fertig: Auf dem Desktop liegt jetzt die Verknüpfung „PerfectGrammar“.' -ForegroundColor Green
Write-Host 'Die App wird jetzt zum ersten Mal gestartet …'
Write-Host ''

& (Join-Path $Base 'starten.ps1')
