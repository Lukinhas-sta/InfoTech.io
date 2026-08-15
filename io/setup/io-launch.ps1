$ErrorActionPreference = 'SilentlyContinue'

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerScript = Join-Path $AppDir 'io-local-server.ps1'
$Url = 'http://127.0.0.1:8765/'
$Health = 'http://127.0.0.1:8765/health'

function Test-LocalUi {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri $Health -TimeoutSec 1
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

if (-not (Test-LocalUi)) {
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy','Bypass',
        '-WindowStyle','Hidden',
        '-File',('"' + $ServerScript + '"')
    ) -WindowStyle Hidden

    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 300
        if (Test-LocalUi) { break }
    }
}

if (Test-LocalUi) {
    Start-Process $Url
    exit 0
}

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show(
    'Nao consegui iniciar a tela local da io. Execute o instalador novamente e tente de novo.',
    'io',
    'OK',
    'Error'
) | Out-Null
exit 1
