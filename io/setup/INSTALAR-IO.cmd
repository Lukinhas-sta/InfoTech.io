@echo off
setlocal
chcp 65001 >nul
title Instalador da io
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-io.ps1"
endlocal
