@echo off
setlocal
chcp 65001 >nul
title Instalador da io

set "IO_PS1=%TEMP%\instalar-io.ps1"

echo Baixando o instalador da io...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing 'https://infotech-io.com.br/io/setup/instalar-io.ps1' -OutFile '%IO_PS1%'"
if errorlevel 1 (
  echo.
  echo Nao foi possivel baixar o instalador da io.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%IO_PS1%"
endlocal
