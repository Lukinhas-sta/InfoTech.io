$ErrorActionPreference = 'Stop'

$Port = 8765
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HtmlPath = Join-Path $AppDir 'local.html'

if (-not (Test-Path $HtmlPath)) {
    throw "Arquivo local.html nao encontrado em $AppDir"
}

# Este modulo e injetado somente na tela servida pelo localhost.
# Ele trata pedidos explicitos de memoria sem chamar o modelo local,
# economizando CPU/RAM e mantendo a memoria separada do historico de conversa.
$MemoryPatch = @'
<script type="module">
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.55.0/+esm';

const SB_URL='https://rgngqumqzylthdiazvfu.supabase.co';
const SB_KEY='sb_publishable_Nw2oaGdMQHVIJNhUpjv5ag_JcxmRu2w';
const memoryDb=createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});

const form=document.querySelector('#composer');
const input=document.querySelector('#input');
const chat=document.querySelector('#chat');
const chatwrap=document.querySelector('#chatwrap');
const notice=document.querySelector('#notice');

function parsePermanentMemory(text){
  const clean=String(text||'').trim();
  const m=clean.match(/^(?:io[\s,.:;\-]*)?(?:lembre|lembra|guarde|guarda|memorize|memoriza)(?:\s+(?:na\s+mem[oó]ria))?\s+(?:que\s+)?(.{2,})$/i);
  if(!m)return null;
  const value=m[1].trim().replace(/[.\s]+$/,'').slice(0,1200);
  return value.length>=2?value:null;
}

function classifyMemoryKind(text){
  const t=String(text||'').toLowerCase();
  if(/\b(prefiro|gosto|adoro|odeio|n[aã]o gosto|favorit[oa])\b/.test(t))return 'preference';
  if(/\b(projeto|empresa|site|aplicativo|app|sistema)\b/.test(t))return 'project';
  if(/\b(todo dia|todos os dias|sempre de manh[aã]|rotina|costumo)\b/.test(t))return 'routine';
  if(/\b(sempre|nunca|quando eu|quero que voc[eê])\b/.test(t))return 'instruction';
  return 'fact';
}

function bubble(role,text){
  const d=document.createElement('div');
  d.className='msg '+role;
  const mini=document.createElement('div');
  mini.className='mini';
  mini.textContent=role==='assistant'?'io':'L';
  const b=document.createElement('div');
  b.className='bubble';
  b.textContent=text;
  d.appendChild(mini);d.appendChild(b);
  return d;
}

function showMemoryResult(userText,reply){
  if(!chat)return;
  const welcome=chat.querySelector('.welcome');
  if(welcome)chat.innerHTML='';
  chat.appendChild(bubble('user',userText));
  chat.appendChild(bubble('assistant',reply));
  requestAnimationFrame(()=>{if(chatwrap)chatwrap.scrollTop=chatwrap.scrollHeight});
}

if(form&&input){
  form.addEventListener('submit',async ev=>{
    const original=input.value.trim();
    const memory=parsePermanentMemory(original);
    if(!memory)return;

    // Intercepta antes do listener normal da conversa para nao mandar este comando ao Qwen.
    ev.preventDefault();
    ev.stopImmediatePropagation();
    input.value='';
    input.style.height='auto';
    if(notice)notice.textContent='Salvando memoria permanente...';

    try{
      const {data:{session}}=await memoryDb.auth.getSession();
      const user=session?.user;
      if(!user)throw new Error('Entre na sua conta da io antes de salvar uma memoria.');

      const kind=classifyMemoryKind(memory);
      const {data:existing,error:findError}=await memoryDb
        .from('alex_memories')
        .select('id')
        .eq('user_id',user.id)
        .eq('content',memory)
        .limit(1);
      if(findError)throw findError;

      let saveError=null;
      if(existing?.length){
        const r=await memoryDb
          .from('alex_memories')
          .update({kind,importance:4,source:'user',updated_at:new Date().toISOString()})
          .eq('id',existing[0].id)
          .eq('user_id',user.id);
        saveError=r.error;
      }else{
        const r=await memoryDb.from('alex_memories').insert({
          user_id:user.id,
          kind,
          content:memory,
          importance:4,
          source:'user'
        });
        saveError=r.error;
      }
      if(saveError)throw saveError;

      const reply='Pronto. Guardei isso na minha memoria permanente: “'+memory+'”.';
      showMemoryResult(original,reply);
      if(notice)notice.textContent='🧠 Memoria permanente salva. Ela pode ser usada em outras conversas.';
    }catch(err){
      const message='Nao consegui salvar essa memoria: '+(err?.message||'erro desconhecido')+'.';
      showMemoryResult(original,message);
      if(notice)notice.textContent=message;
    }
  },true);
}
</script>
'@

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()

            while ($true) {
                $line = $reader.ReadLine()
                if ($null -eq $line -or $line -eq '') { break }
            }

            $path = '/'
            if ($requestLine -match '^GET\s+([^\s]+)\s+HTTP/') {
                $path = $Matches[1].Split('?')[0]
            }

            if ($path -eq '/' -or $path -eq '/local.html') {
                $html = [System.IO.File]::ReadAllText($HtmlPath, [System.Text.Encoding]::UTF8)
                if ($html -match '</body>') {
                    $html = $html.Replace('</body>', ($MemoryPatch + "`r`n</body>"))
                } else {
                    $html = $html + $MemoryPatch
                }
                $body = [System.Text.Encoding]::UTF8.GetBytes($html)
                $status = '200 OK'
                $contentType = 'text/html; charset=utf-8'
            }
            elseif ($path -eq '/health') {
                $body = [System.Text.Encoding]::UTF8.GetBytes('ok')
                $status = '200 OK'
                $contentType = 'text/plain; charset=utf-8'
            }
            elseif ($path -eq '/favicon.ico') {
                $body = [byte[]]::new(0)
                $status = '204 No Content'
                $contentType = 'image/x-icon'
            }
            else {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Nao encontrado')
                $status = '404 Not Found'
                $contentType = 'text/plain; charset=utf-8'
            }

            $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            if ($body.Length -gt 0) {
                $stream.Write($body, 0, $body.Length)
            }
            $stream.Flush()
        }
        catch {
            # Ignora requisicoes interrompidas pelo navegador.
        }
        finally {
            if ($client) { $client.Close() }
        }
    }
}
finally {
    $listener.Stop()
}
