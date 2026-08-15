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
Write-Host 'Perfil preparado para PC com pouca memoria e sem GPU dedicada.'
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
  Step 'Instalando o Ollama'
  Write-Host 'Tentando usar o instalador oficial...'
  try {
    Invoke-RestMethod 'https://ollama.com/install.ps1' | Invoke-Expression
  } catch {
    Write-Host 'A instalacao automatica nao funcionou.' -ForegroundColor Yellow
    Write-Host 'Abrindo a pagina oficial do Ollama para instalar manualmente.' -ForegroundColor Yellow
    Start-Process 'https://ollama.com/download/windows'
    Fail 'Instale o Ollama pela pagina que abriu e depois execute este instalador novamente.'
  }

  for ($i = 0; $i -lt 40 -and -not (Test-Path $ollamaExe); $i++) {
    Start-Sleep -Seconds 1
  }
}

if (-not (Test-Path $ollamaExe)) {
  Fail 'O Ollama nao foi encontrado depois da instalacao.'
}

Step 'Aplicando protecoes para o seu PC'
$settings = @{
  'OLLAMA_ORIGINS' = 'https://infotech-io.com.br'
  'OLLAMA_NO_CLOUD' = '1'
  'OLLAMA_NUM_PARALLEL' = '1'
  'OLLAMA_MAX_LOADED_MODELS' = '1'
  'OLLAMA_CONTEXT_LENGTH' = '4096'
  'OLLAMA_MAX_QUEUE' = '8'
}
foreach ($name in $settings.Keys) {
  [Environment]::SetEnvironmentVariable($name, $settings[$name], 'User')
  Set-Item -Path ("Env:" + $name) -Value $settings[$name]
}

Write-Host 'Configurado:' -ForegroundColor Green
Write-Host ' - somente 1 modelo carregado'
Write-Host ' - somente 1 resposta processada por vez'
Write-Host ' - contexto padrao limitado a 4096 tokens'
Write-Host ' - recursos de nuvem do Ollama desativados'
Write-Host ' - acesso web permitido apenas para o site da io'

Step 'Reiniciando o servidor local'
Get-Process -Name 'ollama' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
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
Write-Host 'O modelo ocupa aproximadamente 2,5 GB. O tempo depende da sua internet.' -ForegroundColor Yellow
& $ollamaExe pull 'qwen3:4b-instruct'
if ($LASTEXITCODE -ne 0) {
  Fail 'O download do modelo nao terminou corretamente.'
}

Step 'Fazendo um teste em Modo Leve'
try {
  $body = @{
    model = 'qwen3:4b-instruct'
    messages = @(@{ role = 'user'; content = 'Responda apenas: io pronta.' })
    stream = $false
    think = $false
    keep_alive = 0
    options = @{
      num_ctx = 2048
      num_predict = 32
      temperature = 0.3
    }
  } | ConvertTo-Json -Depth 10
  $test = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:11434/api/chat' -ContentType 'application/json' -Body $body -TimeoutSec 300
  if (-not $test.message.content) { throw 'Resposta vazia' }
  Write-Host ('Teste concluido: ' + $test.message.content.Trim()) -ForegroundColor Green
  Write-Host 'O modelo foi descarregado depois do teste para liberar memoria.' -ForegroundColor Green
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
Write-Host 'Modo inicial recomendado: LEVE'
Write-Host 'Endereco do cerebro: http://127.0.0.1:11434'
Write-Host 'Tela da io: https://infotech-io.com.br/io/local.html'
Write-Host ''
Write-Host 'Na tela voce tera:' -ForegroundColor Cyan
Write-Host '  Modo Leve       - recomendado para o seu PC'
Write-Host '  Modo Inteligente - mais contexto quando o PC estiver livre'
Write-Host '  Modo Jogo       - descarrega a IA e libera memoria'
Write-Host ''
Write-Host 'Abrindo a io no navegador...' -ForegroundColor Cyan
Start-Process 'https://infotech-io.com.br/io/local.html'
Write-Host ''
Read-Host 'Quando a tela abrir, pressione ENTER para fechar o instalador'
