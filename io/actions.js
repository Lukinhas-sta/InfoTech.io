import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.55.0/+esm';

const SB_URL='https://rgngqumqzylthdiazvfu.supabase.co';
const SB_KEY='sb_publishable_Nw2oaGdMQHVIJNhUpjv5ag_JcxmRu2w';
const db=createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
const form=document.querySelector('#composer');
const input=document.querySelector('#input');
const chat=document.querySelector('#chat');
const chatwrap=document.querySelector('#chatwrap');
const notice=document.querySelector('#notice');

const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[.!?]+$/,'').replace(/\s+/g,' ');
const clean=s=>String(s||'').trim().replace(/[.!?]+$/,'').trim();
const listName=s=>clean(s).replace(/^(?:de\s+|da\s+|do\s+)/i,'').toLowerCase().slice(0,80);
const itemName=s=>clean(s).slice(0,300);

function bubble(role,text){
  const d=document.createElement('div'); d.className='msg '+role;
  const mini=document.createElement('div'); mini.className='mini'; mini.textContent=role==='assistant'?'io':'L';
  const b=document.createElement('div'); b.className='bubble'; b.textContent=text;
  d.appendChild(mini); d.appendChild(b); return d;
}
function show(userText,reply){
  if(!chat)return;
  if(chat.querySelector('.welcome'))chat.innerHTML='';
  chat.appendChild(bubble('user',userText));
  chat.appendChild(bubble('assistant',reply));
  if(localStorage.getItem('io_speak')==='1' && 'speechSynthesis' in window){
    speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(reply.slice(0,1500)); u.lang='pt-BR'; speechSynthesis.speak(u);
  }
  requestAnimationFrame(()=>{if(chatwrap)chatwrap.scrollTop=chatwrap.scrollHeight});
}
function setNotice(t){if(notice)notice.textContent=t}

function parseMemory(text){
  const m=clean(text).match(/^(?:io[\s,.:;\-]*)?(?:lembre|lembra|guarde|guarda|memorize|memoriza)(?:\s+(?:na\s+mem[oó]ria))?\s+(?:que\s+)?(.{2,})$/i);
  return m?clean(m[1]).slice(0,1200):null;
}
function classifyMemory(v){
  const x=norm(v);
  if(/\b(gosto|prefiro|favorit|nao gosto)\b/.test(x))return 'preference';
  if(/\b(projeto|empresa|site|app|aplicativo|negocio)\b/.test(x))return 'project';
  if(/\b(todo dia|toda semana|rotina|sempre faco)\b/.test(x))return 'routine';
  if(/\b(mae|pai|irmao|irma|amigo|amiga|esposa|marido|namorada|namorado)\b/.test(x))return 'person';
  return 'fact';
}

function parseList(text){
  const t=clean(text);
  let m;
  if(/^(?:io[\s,.:;\-]*)?(?:quais|qual).*(?:minhas|minha)\s+listas?$/i.test(t) || /^(?:io[\s,.:;\-]*)?(?:mostre|mostra|liste|lista)\s+(?:minhas\s+)?listas$/i.test(t)) return {op:'lists'};
  m=t.match(/^(?:io[\s,.:;\-]*)?(?:adicione|adiciona|adicionar|coloque|coloca|bote|bota)\s+(.+?)\s+(?:na|à|a)\s+(?:minha\s+)?lista(?:\s+de)?\s+(.+)$/i);
  if(m)return {op:'add',item:itemName(m[1]),list:listName(m[2])};
  m=t.match(/^(?:io[\s,.:;\-]*)?(?:remova|remove|retire|tire|tira|apague|apaga)\s+(.+?)\s+(?:da|de)\s+(?:minha\s+)?lista(?:\s+de)?\s+(.+)$/i);
  if(m)return {op:'remove',item:itemName(m[1]),list:listName(m[2])};
  m=t.match(/^(?:io[\s,.:;\-]*)?(?:marque|marca|conclua|conclui)\s+(.+?)\s+(?:como\s+)?(?:feito|feita|conclu[ií]do|conclu[ií]da)\s+(?:na|da)\s+(?:minha\s+)?lista(?:\s+de)?\s+(.+)$/i);
  if(m)return {op:'done',item:itemName(m[1]),list:listName(m[2])};
  m=t.match(/^(?:io[\s,.:;\-]*)?(?:o\s+que\s+tem|mostre|mostra|liste|lista|ver)\s+(?:na\s+|a\s+)?(?:minha\s+)?lista(?:\s+de)?\s+(.+)$/i);
  if(m)return {op:'show',list:listName(m[1])};
  return null;
}

async function sessionUser(){const {data:{session}}=await db.auth.getSession(); return session?.user||null}
async function getList(userId,name){
  const {data,error}=await db.from('io_lists').select('id,name').eq('user_id',userId).eq('name',name).maybeSingle();
  if(error)throw error; return data||null;
}
async function ensureList(userId,name){
  let list=await getList(userId,name); if(list)return list;
  const {data,error}=await db.from('io_lists').insert({user_id:userId,name}).select('id,name').single();
  if(error)throw error; return data;
}
async function itemsOf(userId,listId){
  const {data,error}=await db.from('io_list_items').select('id,content,done,created_at').eq('user_id',userId).eq('list_id',listId).order('done',{ascending:true}).order('created_at',{ascending:true}).limit(200);
  if(error)throw error; return data||[];
}
async function runList(cmd,user){
  if(cmd.op==='lists'){
    const {data,error}=await db.from('io_lists').select('name').eq('user_id',user.id).order('name',{ascending:true});
    if(error)throw error; const names=(data||[]).map(x=>x.name);
    return names.length?'Suas listas são: '+names.join(', ')+'.':'Você ainda não tem nenhuma lista.';
  }
  if(!cmd.list)throw new Error('Diga o nome da lista');
  if(cmd.op==='add'){
    const list=await ensureList(user.id,cmd.list); const items=await itemsOf(user.id,list.id);
    if(items.some(x=>!x.done&&norm(x.content)===norm(cmd.item)))return '“'+cmd.item+'” já está na lista de '+cmd.list+'.';
    const {error}=await db.from('io_list_items').insert({list_id:list.id,user_id:user.id,content:cmd.item,done:false}); if(error)throw error;
    return 'Pronto. Adicionei “'+cmd.item+'” à lista de '+cmd.list+'.';
  }
  const list=await getList(user.id,cmd.list);
  if(!list)return 'A lista de '+cmd.list+' ainda não existe.';
  const items=await itemsOf(user.id,list.id);
  if(cmd.op==='show'){
    if(!items.length)return 'A lista de '+cmd.list+' está vazia.';
    const pending=items.filter(x=>!x.done), done=items.filter(x=>x.done);
    let out='Lista de '+cmd.list+': ';
    out+=pending.length?pending.map((x,i)=>(i+1)+'. '+x.content).join('; '):'nenhum item pendente';
    if(done.length)out+=' — concluídos: '+done.map(x=>x.content).join(', ');
    return out+'.';
  }
  const target=items.find(x=>norm(x.content)===norm(cmd.item));
  if(!target)return 'Não encontrei “'+cmd.item+'” na lista de '+cmd.list+'.';
  if(cmd.op==='remove'){
    const {error}=await db.from('io_list_items').delete().eq('id',target.id).eq('user_id',user.id); if(error)throw error;
    return 'Removi “'+target.content+'” da lista de '+cmd.list+'.';
  }
  if(cmd.op==='done'){
    const {error}=await db.from('io_list_items').update({done:true,updated_at:new Date().toISOString()}).eq('id',target.id).eq('user_id',user.id); if(error)throw error;
    return 'Marquei “'+target.content+'” como concluído na lista de '+cmd.list+'.';
  }
}

async function saveMemory(memory,user){
  const {data:existing,error:findError}=await db.from('alex_memories').select('id').eq('user_id',user.id).eq('content',memory).limit(1); if(findError)throw findError;
  if(existing?.length){const {error}=await db.from('alex_memories').update({importance:4,source:'user',updated_at:new Date().toISOString()}).eq('id',existing[0].id).eq('user_id',user.id); if(error)throw error;}
  else {const {error}=await db.from('alex_memories').insert({user_id:user.id,kind:classifyMemory(memory),content:memory,importance:4,source:'user'}); if(error)throw error;}
  return 'Pronto. Guardei isso na minha memória permanente: "'+memory+'".';
}

if(form&&input){
  form.addEventListener('submit',async ev=>{
    const original=input.value.trim(); if(!original)return;
    const memory=parseMemory(original); const cmd=parseList(original);
    if(!memory&&!cmd)return;
    ev.preventDefault(); ev.stopImmediatePropagation(); input.value=''; input.style.height='auto';
    setNotice(memory?'Salvando memória permanente...':'Executando comando da lista...');
    try{
      const user=await sessionUser(); if(!user)throw new Error('Entre na sua conta da io primeiro');
      const reply=memory?await saveMemory(memory,user):await runList(cmd,user);
      show(original,reply); setNotice(memory?'🧠 Memória permanente salva.':'✅ Comando executado sem enviar ao Qwen.');
    }catch(err){const reply='Não consegui executar: '+(err?.message||'erro desconhecido')+'.'; show(original,reply); setNotice(reply);}
  },true);
}
