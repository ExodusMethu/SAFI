@echo off
title MP3DL Pro - Playlist Fetcher ^& Downloader
echo =======================================================
echo  Starting MP3DL Web UI Server...
echo =======================================================
echo.
python "%~dp0app_server.py"
pause
