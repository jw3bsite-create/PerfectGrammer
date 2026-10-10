@echo off
rem Einmal doppelklicken: legt die Verknuepfung "Sprachrichtigkeit" auf dem Desktop an und startet die App.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\einrichten.ps1"
pause
