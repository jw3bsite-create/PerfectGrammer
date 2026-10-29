# Installiert Ollama und ein Sprachmodell fuer die KI-Bewertung in PerfectGrammar.
# Aufruf in PowerShell (eine Zeile):
#   irm https://raw.githubusercontent.com/jw3bsite-create/PerfectGrammer/claude/sprachrichtigkeit-app-xzd9cl/windows/ki-einrichten-online.ps1 | iex
# Bewusst nur ASCII-Zeichen: Der Text wird direkt ausgefuehrt, ohne Datei.

$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

function Find-Ollama {
  $cmd = Get-Command ollama -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @((Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'), (Join-Path $env:ProgramFiles 'Ollama\ollama.exe'))) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Test-Ollama {
  try { Invoke-RestMethod -Uri 'http://localhost:11434/api/tags' -TimeoutSec 3 | Out-Null; return $true } catch { return $false }
}

Write-Host ''
Write-Host '  PerfectGrammar: lokale KI einrichten' -ForegroundColor Cyan
Write-Host ''

$exe = Find-Ollama
if (-not $exe) {
  Write-Host 'Ollama wird installiert ...'
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
  } else {
    $setup = Join-Path ([IO.Path]::GetTempPath()) 'OllamaSetup.exe'
    Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile $setup -UseBasicParsing
    Start-Process -FilePath $setup -Wait
  }
  $exe = Find-Ollama
}

if (-not $exe) {
  Write-Host ''
  Write-Host 'Ollama wurde nicht gefunden. Bitte von https://ollama.com/download installieren und diese Zeile noch einmal ausfuehren.' -ForegroundColor Yellow
} else {
  if (-not (Test-Ollama)) {
    Write-Host 'Ollama wird gestartet ...'
    Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden
    for ($i = 0; $i -lt 20 -and -not (Test-Ollama); $i++) { Start-Sleep -Seconds 1 }
  }

  # Modell nach Arbeitsspeicher: ab etwa 16 GB das bessere 7B-Modell, sonst das kleinere.
  $gb = 8
  try { $gb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB) } catch { }
  $model = if ($gb -ge 14) { 'qwen2.5:7b' } else { 'qwen2.5:3b' }
  Write-Host "Arbeitsspeicher: etwa $gb GB. Modell $model wird geladen (einmalig, das dauert ein paar Minuten) ..."
  & $exe pull $model

  Write-Host ''
  if (Test-Ollama) {
    Write-Host 'Fertig. Die lokale KI laeuft.' -ForegroundColor Green
    Write-Host 'In PerfectGrammar: Zusammenfassen -> KI -> "Lokale KI (auf dem PC)" -> "Lokale KI suchen" -> "Verwenden".'
  } else {
    Write-Host 'Das Modell ist geladen, aber Ollama antwortet noch nicht. Starte Ollama ueber das Startmenue und suche dann in PerfectGrammar nach der lokalen KI.' -ForegroundColor Yellow
  }
}
Write-Host ''
