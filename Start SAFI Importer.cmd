@echo off
title SAFI Playlist Importer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-music-import.ps1" %*
echo.
echo The SAFI importer is off. You can close this window.
pause
