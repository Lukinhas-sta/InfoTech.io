$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Instalador da io'

function Step($text) {
  Write-Host ""
  Write-Host "==> $text" -ForegroundColor Cyan
}

function Fail($text) {
  Write-Host ""
  Write-Host $text -ForegroundColor Red
  Write-Host ""
  Read-Host 'Pressione ENTER para fechar'
  exit 1
}

Write-Host '=========================================' -ForegroundColor Magenta
Write-Host '        io - Assistente Local' -ForegroundColor White
Write-Host '=========================================' -ForegroundColor Magenta
Write-Host 'Este instalador prepara o Ollama e o modelo Qwen3 4B no seu PC.'
Write-Host 'As respostas locais nao usam creditos da API da OpenAI.'

if ([Environment]::OSVersion.Platform -ne 'Win32NT') {
  Fail 'Este instalador foi preparado para Windows.'
}

$drive = Get-PSDrive -Name ($env:SystemDrive.TrimEnd(':')) -ErrorAction SilentlyContinue
if ($drive -and $drive.Free -lt 8GB) {
  Fail 'Deixe pelo menos 8 GB livres no disco antes de instalar a io.'
}

$ollamaExe = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'

if (-not (Test-Path $ollamaExe)) {
  Step 'Instalando o Ollama oficial'
  Write-Host 'Baixando pelo instalador oficial do Ollama...'
  try {
    Invoke-RestMethod 'https://ollama.com/install.ps1' | Invoke-Expression
  } catch {
    Fail ("Nao foi possivel instalar o Ollama automaticamente. Erro: " + $_.Exception.Message)
  }

  for ($i = 0; $i -lt 30 -and -not (Test-Path $ollamaExe); $i++) {
    Start-Sleep -Seconds 1
  }
}

if (-not (Test-Path $ollamaExe)) {
  Fail 'O Ollama nao foi encontrado depois da instalacao.'
}

Step 'Configurando acesso seguro da pagina da io ao cerebro local'
[Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', 'https://infotech-io.com.br', 'User')
$env:OLLAMA_ORIGINS = 'https://infotech-io.com.br'

Step 'Reiniciando o servidor local da io'
Get-Process -Name 'ollama' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden

$ready = $false
for ($i = 0; $i -lt 25; $i++) {
  try {
    $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/version' -TimeoutSec 2
    $ready = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $ready) {
  Fail 'O Ollama foi instalado, mas o servidor local ainda nao iniciou.'
}

Step 'Baixando o cerebro Qwen3 4B Instruct'
Write-Host 'O download tem aproximadamente 2,5 GB. O tempo depende da sua internet.' -ForegroundColor Yellow
& $ollamaExe pull 'qwen3:4b-instruct'
if ($LASTEXITCODE -ne 0) {
  Fail 'O download do modelo nao terminou corretamente.'
}

Step 'Fazendo um teste rapido'
try {
  $body = @{
    model = 'qwen3:4b-instruct'
    messages = @(@{ role = 'user'; content = 'Responda apenas: io pronta.' })
    stream = $false
    think = $false
    keep_alive = '10m'
  } | ConvertTo-Json -Depth 8
  $test = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:11434/api/chat' -ContentType 'application/json' -Body $body -TimeoutSec 240
  if (-not $test.message.content) { throw 'Resposta vazia' }
  Write-Host ('Teste concluido: ' + $test.message.content.Trim()) -ForegroundColor Green
} catch {
  Write-Host 'O modelo foi instalado, mas o teste automatico nao terminou. Vamos testar pela tela da io.' -ForegroundColor Yellow
}

Step 'Criando atalho da io na Area de Trabalho'
try {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shortcut = Join-Path $desktop 'io.url'
  @"
[InternetShortcut]
URL=https://infotech-io.com.br/io/local.html
IconIndex=0
"@ | Set-Content -Path $shortcut -Encoding ASCII
} catch {
  Write-Host 'Nao consegui criar o atalho, mas a instalacao principal esta pronta.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '=========================================' -ForegroundColor Green
Write-Host '             IO PRONTA' -ForegroundColor Green
Write-Host '=========================================' -ForegroundColor Green
Write-Host 'Modelo: qwen3:4b-instruct'
Write-Host 'Endereco local do cerebro: http://127.0.0.1:11434'
Write-Host 'Tela da io: https://infotech-io.com.br/io/local.html'
Write-Host ''
Write-Host 'Abrindo a io no navegador...' -ForegroundColor Cyan
Start-Process 'https://infotech-io.com.br/io/local.html'
Write-Host ''
Read-Host 'Quando a tela abrir, pressione ENTER para fechar o instalador'
