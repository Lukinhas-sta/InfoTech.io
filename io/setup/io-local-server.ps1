$ErrorActionPreference = 'Stop'

$Port = 8765
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HtmlPath = Join-Path $AppDir 'local.html'

if (-not (Test-Path $HtmlPath)) {
    throw "Arquivo local.html nao encontrado em $AppDir"
}

# Memoria permanente: intercepta apenas pedidos explicitos e salva sem chamar o Qwen.
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
function classifyMemory(value){
  const v=value.toLowerCase();
  if(/\b(gosto|prefiro|favorit|não gosto|nao gosto)\b/.test(v))return 'preference';
  if(/\b(projeto|empresa|site|app|aplicativo|negócio|negocio)\b/.test(v))return 'project';
  if(/\b(todo dia|toda semana|rotina|sempre faço|sempre faco)\b/.test(v))return 'routine';
  if(/\b(mãe|mae|pai|irmão|irmao|irmã|irma|amigo|amiga|esposa|marido|namorada|namorado)\b/.test(v))return 'person';
  return 'fact';
}
function bubble(role,text){
  const d=document.createElement('div'); d.className='msg '+role;
  const mini=document.createElement('div'); mini.className='mini'; mini.textContent=role==='assistant'?'io':'L';
  const b=document.createElement('div'); b.className='bubble'; b.textContent=text;
  d.appendChild(mini); d.appendChild(b); return d;
}
function showMemoryResult(userText,reply){
  if(!chat)return;
  const welcome=chat.querySelector('.welcome'); if(welcome)chat.innerHTML='';
  chat.appendChild(bubble('user',userText)); chat.appendChild(bubble('assistant',reply));
  requestAnimationFrame(()=>{if(chatwrap)chatwrap.scrollTop=chatwrap.scrollHeight});
}
if(form&&input){
  form.addEventListener('submit',async ev=>{
    const original=input.value.trim();
    const memory=parsePermanentMemory(original);
    if(!memory)return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    input.value=''; input.style.height='auto';
    if(notice)notice.textContent='Salvando memória permanente...';
    try{
      const {data:{session}}=await memoryDb.auth.getSession();
      const user=session?.user;
      if(!user)throw new Error('Entre na sua conta da io antes de salvar uma memória');
      const {data:existing,error:findError}=await memoryDb.from('alex_memories').select('id').eq('user_id',user.id).eq('content',memory).limit(1);
      if(findError)throw findError;
      let saveError=null;
      if(existing?.length){
        const r=await memoryDb.from('alex_memories').update({importance:4,source:'user',updated_at:new Date().toISOString()}).eq('id',existing[0].id).eq('user_id',user.id);
        saveError=r.error;
      }else{
        const r=await memoryDb.from('alex_memories').insert({user_id:user.id,kind:classifyMemory(memory),content:memory,importance:4,source:'user'});
        saveError=r.error;
      }
      if(saveError)throw saveError;
      showMemoryResult(original,'Pronto. Guardei isso na minha memória permanente: "'+memory+'".');
      if(notice)notice.textContent='🧠 Memória permanente salva. Ela pode ser usada em outras conversas.';
    }catch(err){
      const message='Não consegui salvar essa memória: '+(err?.message||'erro desconhecido')+'.';
      showMemoryResult(original,message); if(notice)notice.textContent=message;
    }
  },true);
}
</script>
'@

# Voz local da interface. Não envia automaticamente: transcreve, mostra e o usuário confirma.
$VoicePatch = @'
<script>
(()=>{
  function ready(fn){ if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true}); else setTimeout(fn,0); }
  ready(()=>{
    const oldMic=document.querySelector('#mic');
    const input=document.querySelector('#input');
    const notice=document.querySelector('#notice');
    const voiceToggle=document.querySelector('#voiceToggle');
    const modeSelect=document.querySelector('#modeSelect');
    if(!oldMic||!input)return;

    const mic=oldMic.cloneNode(true);
    oldMic.replaceWith(mic);
    mic.id='mic';
    mic.type='button';
    mic.title='Falar com a io';
    mic.setAttribute('aria-label','Falar com a io');

    let rec=null, listening=false;
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;

    const sayNotice=(text)=>{ if(notice)notice.textContent=text; };
    const resetMic=()=>{
      listening=false;
      mic.classList.remove('on');
      mic.textContent='🎙️';
      mic.title='Falar com a io';
      mic.setAttribute('aria-pressed','false');
    };
    const errorMessage=(code)=>{
      const map={
        'not-allowed':'Permissão do microfone negada. Libere o microfone para 127.0.0.1 nas configurações do navegador.',
        'service-not-allowed':'O navegador bloqueou o serviço de reconhecimento de voz.',
        'audio-capture':'Não encontrei um microfone neste aparelho.',
        'no-speech':'Não ouvi nenhuma fala. Toque no microfone e tente novamente.',
        'network':'O reconhecimento de voz do navegador ficou sem conexão.',
        'aborted':'Reconhecimento de voz cancelado.'
      };
      return map[code]||('Erro de voz: '+code+'.');
    };

    if(!SpeechRecognition){
      mic.disabled=true;
      mic.title='Este navegador não oferece reconhecimento de voz';
      sayNotice('🎙️ Reconhecimento de voz não está disponível neste navegador. A saída de voz da io continua funcionando.');
    } else {
      rec=new SpeechRecognition();
      rec.lang='pt-BR';
      rec.continuous=false;
      rec.interimResults=true;
      rec.maxAlternatives=1;

      rec.onstart=()=>{
        listening=true; mic.classList.add('on'); mic.textContent='⏹️'; mic.title='Parar de ouvir';
        mic.setAttribute('aria-pressed','true');
        sayNotice('🎙️ Ouvindo... fale uma frase. A io não envia nada até você confirmar.');
      };
      rec.onresult=(ev)=>{
        let finalText='', interim='';
        for(let i=ev.resultIndex;i<ev.results.length;i++){
          const t=ev.results[i][0]?.transcript||'';
          if(ev.results[i].isFinal) finalText+=t; else interim+=t;
        }
        const text=(finalText||interim).trim();
        if(text){
          input.value=text.slice(0,4000);
          input.dispatchEvent(new Event('input',{bubbles:true}));
          sayNotice(finalText ? '✅ Entendi: "'+text+'". Revise e pressione enviar.' : '🎙️ Ouvindo: "'+text+'"');
        }
      };
      rec.onerror=(ev)=>{ sayNotice(errorMessage(ev.error||'desconhecido')); resetMic(); };
      rec.onend=()=>resetMic();

      mic.addEventListener('click',async ()=>{
        if(modeSelect?.value==='game'){ sayNotice('🎮 O microfone fica pausado no Modo Jogo.'); return; }
        if(listening){ try{rec.stop()}catch{} return; }
        try{
          if(navigator.mediaDevices?.getUserMedia){
            const stream=await navigator.mediaDevices.getUserMedia({audio:true});
            stream.getTracks().forEach(t=>t.stop());
          }
        }catch(err){
          const name=err?.name||'';
          if(name==='NotFoundError'||name==='DevicesNotFoundError') sayNotice('🎙️ Não encontrei microfone neste aparelho.');
          else if(name==='NotAllowedError'||name==='PermissionDeniedError') sayNotice('🎙️ Permissão negada. Libere o microfone para 127.0.0.1 no navegador.');
          else sayNotice('🎙️ Não consegui acessar o microfone: '+name+'.');
          return;
        }
        try{ rec.start(); }catch(err){ sayNotice('🎙️ O microfone já estava iniciando. Aguarde um instante e tente novamente.'); }
      });
    }

    if(voiceToggle && !document.querySelector('#voiceTest')){
      const test=document.createElement('button');
      test.id='voiceTest'; test.type='button'; test.className='btn';
      test.textContent='🔈 Teste'; test.title='Testar a voz da io';
      voiceToggle.insertAdjacentElement('afterend',test);
      test.addEventListener('click',()=>{
        if(!('speechSynthesis' in window)){ sayNotice('🔈 Este navegador não oferece saída de voz.'); return; }
        window.speechSynthesis.cancel();
        const u=new SpeechSynthesisUtterance('Olá. Eu sou a io. Minha voz está funcionando.');
        u.lang='pt-BR'; u.rate=1; u.pitch=1;
        const voices=window.speechSynthesis.getVoices();
        const pt=voices.find(v=>/^pt-BR$/i.test(v.lang))||voices.find(v=>/^pt/i.test(v.lang));
        if(pt)u.voice=pt;
        u.onstart=()=>sayNotice('🔊 Testando a voz da io...');
        u.onend=()=>sayNotice('✅ Saída de voz funcionando.');
        u.onerror=()=>sayNotice('🔈 Não consegui reproduzir a voz neste navegador.');
        window.speechSynthesis.speak(u);
      });
    }
  });
})();
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
            if ($requestLine -match '^GET\s+([^\s]+)\s+HTTP/') { $path = $Matches[1].Split('?')[0] }

            if ($path -eq '/' -or $path -eq '/local.html') {
                $html = [System.IO.File]::ReadAllText($HtmlPath, [System.Text.Encoding]::UTF8)
                $patch = $MemoryPatch + "`r`n" + $VoicePatch
                if ($html -match '</body>') { $html = $html.Replace('</body>', ($patch + "`r`n</body>")) }
                else { $html = $html + $patch }
                $body = [System.Text.Encoding]::UTF8.GetBytes($html)
                $status = '200 OK'; $contentType = 'text/html; charset=utf-8'
            }
            elseif ($path -eq '/health') {
                $body = [System.Text.Encoding]::UTF8.GetBytes('ok')
                $status = '200 OK'; $contentType = 'text/plain; charset=utf-8'
            }
            elseif ($path -eq '/favicon.ico') {
                $body = [byte[]]::new(0)
                $status = '204 No Content'; $contentType = 'image/x-icon'
            }
            else {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Nao encontrado')
                $status = '404 Not Found'; $contentType = 'text/plain; charset=utf-8'
            }

            $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
            $stream.Flush()
        }
        catch { }
        finally { if ($client) { $client.Close() } }
    }
}
finally { $listener.Stop() }
