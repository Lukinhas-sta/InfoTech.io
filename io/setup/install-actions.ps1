$ErrorActionPreference = 'Stop'

$AppDir = Join-Path $env:LOCALAPPDATA 'io'
$HtmlPath = Join-Path $AppDir 'local.html'
$ActionsUrl = 'https://raw.githubusercontent.com/Lukinhas-sta/InfoTech.io/main/io/actions.js'
$ActionsPath = Join-Path $env:TEMP 'io-actions.js'
$Launcher = Join-Path $AppDir 'io-launch.ps1'

if (-not (Test-Path $HtmlPath)) {
    throw 'A instalacao local da io nao foi encontrada. Execute primeiro o instalador principal.'
}
if (-not (Test-Path $Launcher)) {
    throw 'O iniciador local da io nao foi encontrado.'
}

Write-Host '[1/4] Baixando os novos comandos...' -ForegroundColor Cyan
Invoke-WebRequest -UseBasicParsing -Uri $ActionsUrl -OutFile $ActionsPath

Write-Host '[2/4] Instalando o modulo de listas...' -ForegroundColor Cyan
$html = [System.IO.File]::ReadAllText($HtmlPath, [System.Text.Encoding]::UTF8)
$actions = [System.IO.File]::ReadAllText($ActionsPath, [System.Text.Encoding]::UTF8)

$startMarker = '<!-- IO_ACTIONS_START -->'
$endMarker = '<!-- IO_ACTIONS_END -->'
$markerPattern = '(?s)' + [regex]::Escape($startMarker) + '.*?' + [regex]::Escape($endMarker)
$html = [regex]::Replace($html, $markerPattern, '')

$block = "`r`n$startMarker`r`n<script type=`"module`">`r`n$actions`r`n</script>`r`n$endMarker`r`n"
if ($html.Contains('</body>')) {
    $html = $html.Replace('</body>', $block + '</body>')
} else {
    $html += $block
}

[System.IO.File]::WriteAllText($HtmlPath, $html, [System.Text.UTF8Encoding]::new($false))

Write-Host '[3/4] Reiniciando somente a tela local...' -ForegroundColor Cyan
$c = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
if ($c) {
    $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 2

Write-Host '[4/4] Abrindo a io...' -ForegroundColor Cyan
Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',('"' + $Launcher + '"'))

Write-Host ''
Write-Host 'Atualizacao concluida.' -ForegroundColor Green
Write-Host 'Teste: io, adiciona arroz na minha lista de compras'
Write-Host 'Depois: io, o que tem na minha lista de compras?'
