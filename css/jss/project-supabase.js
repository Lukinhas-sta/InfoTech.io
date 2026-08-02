(() => {
  'use strict';
  const cfg=window.INFOTECH_SUPABASE_CONFIG;
  if(!cfg||!window.supabase)return;
  const db=window.infotechSupabase||window.supabase.createClient(cfg.url,cfg.publishableKey);
  window.infotechSupabase=db;
  const protocol=new URLSearchParams(location.search).get('id');
  if(!protocol)return;
  const defaults=['Planejamento','Design','Desenvolvimento','Testes','Entrega'];
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt=iso=>iso?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso)):'Data não informada';
  const fmtDate=v=>{if(!v)return'A definir';const [y,m,d]=String(v).split('-').map(Number);return y&&m&&d?new Intl.DateTimeFormat('pt-BR').format(new Date(y,m-1,d)):'A definir'};
  const normalize=p=>{p=p&&typeof p==='object'?p:{};return {deadline:p.deadline||'',stages:Array.isArray(p.stages)&&p.stages.length?p.stages:defaults.map((name,i)=>({id:`stage-${i+1}`,name,done:false,doneAt:null})),history:Array.isArray(p.history)?p.history:[],updatedAt:p.updatedAt||null};};
  const progress=p=>Math.round((p.stages.filter(s=>s.done).length/p.stages.length)*100);
  const history=(item,p)=>{const events=[...p.history];if(item.created_at)events.push({text:'Solicitação criada pelo cliente.',at:item.created_at});return events.filter(e=>e.at).sort((a,b)=>new Date(b.at)-new Date(a.at));};
  const renderHistory=(el,item,p)=>{if(!el)return;const ev=history(item,p);el.innerHTML=ev.length?`<ol class="activity-list">${ev.slice(0,30).map(e=>`<li class="activity-item"><span class="activity-dot"></span><div class="activity-content"><strong>${esc(e.text)}</strong><span>${fmt(e.at)}</span></div></li>`).join('')}</ol>`:'<div class="project-empty">Ainda não há atividades registradas.</div>';};
  async function init(){
    const {data:item,error}=await db.from('requests').select('id,protocol,status,project,created_at,updated_at').eq('protocol',protocol).maybeSingle();
    if(error||!item)return;
    const p=normalize(item.project);
    const admin=document.getElementById('admin-project-area');
    if(admin){
      const form=document.getElementById('admin-project-form'),deadline=document.getElementById('admin-project-deadline'),stages=document.getElementById('admin-project-stages'),feedback=document.getElementById('admin-project-feedback');
      deadline.value=p.deadline;
      const render=()=>{stages.innerHTML=p.stages.map((s,i)=>`<label class="project-stage-admin"><input type="checkbox" data-stage-index="${i}" ${s.done?'checked':''}/><input type="text" maxlength="60" data-stage-name="${i}" value="${esc(s.name)}" aria-label="Nome da etapa ${i+1}"/></label>`).join('');const pct=progress(p);admin.querySelector('[data-admin-project-progress]').textContent=`${pct}%`;admin.querySelector('[data-admin-project-bar]').style.width=`${pct}%`;};
      render();renderHistory(document.getElementById('admin-project-history'),item,p);
      form.addEventListener('submit',async e=>{e.preventDefault();const now=new Date().toISOString();p.deadline=deadline.value;p.stages.forEach((s,i)=>{const done=stages.querySelector(`[data-stage-index="${i}"]`).checked;const name=stages.querySelector(`[data-stage-name="${i}"]`).value.trim()||s.name;if(done!==s.done)p.history.unshift({id:crypto.randomUUID(),text:done?`Etapa “${name}” concluída.`:`Etapa “${name}” reaberta.`,at:now});s.done=done;s.name=name;s.doneAt=done?(s.doneAt||now):null;});p.updatedAt=now;const pct=progress(p);const status=pct===100?'Concluída':(item.status==='Aprovada'||item.status==='Em andamento'||item.status==='Concluída'?'Em andamento':item.status);feedback.textContent='Salvando andamento...';feedback.className='form-message';const {data:saved,error:saveError}=await db.rpc('admin_update_request_project',{p_request_id:item.id,p_project:p,p_status:status});const savedRow=Array.isArray(saved)?saved[0]:saved;if(saveError||!savedRow){console.error('Falha ao salvar andamento:',saveError);const raw=saveError?.message||'';feedback.textContent=raw.includes('schema cache')?'A função de salvamento ainda não foi carregada pelo Supabase. Execute novamente o SQL da versão 5.0.5 e aguarde alguns segundos.':(raw||'Não foi possível salvar o andamento.');feedback.className='form-message error';return;}item.project=savedRow.project||p;item.status=savedRow.status||status;item.updated_at=savedRow.updated_at||item.updated_at;const confirmed=normalize(item.project);p.deadline=confirmed.deadline;p.stages=confirmed.stages;p.history=confirmed.history;p.updatedAt=confirmed.updatedAt;const u=(await db.auth.getUser()).data.user;if(u)await db.from('request_events').insert({request_id:item.id,actor_id:u.id,actor_role:'admin',event_type:'project_progress',title:'Andamento do projeto atualizado',description:`${progress(p)}% concluído · previsão ${fmtDate(p.deadline)}`,read_by_admin:true,read_by_client:false});feedback.textContent='Andamento salvo e disponibilizado para o cliente.';feedback.className='form-message success';render();renderHistory(document.getElementById('admin-project-history'),item,p);});
    }
    const client=document.getElementById('client-project-area');
    if(client){const pct=progress(p),current=p.stages.find(s=>!s.done);client.innerHTML=`<div class="project-heading"><div><span class="eyebrow">Acompanhamento</span><h2>Andamento do projeto</h2><p>Acompanhe as etapas definidas pela Infotech.</p></div><strong class="project-progress-number">${pct}% concluído</strong></div><div class="project-progress"><span style="width:${pct}%"></span></div><div class="project-meta"><div><span>Status</span><strong>${esc(item.status)}</strong></div><div><span>Previsão de entrega</span><strong>${esc(fmtDate(p.deadline))}</strong></div><div><span>Última atualização</span><strong>${fmt(p.updatedAt||item.updated_at||item.created_at)}</strong></div></div><div class="project-stages">${p.stages.map(s=>`<div class="project-stage ${s.done?'done':current?.id===s.id?'current':''}"><span class="project-stage-dot">${s.done?'✓':''}</span><div><strong>${esc(s.name)}</strong><span>${s.done?'Etapa concluída':current?.id===s.id?'Etapa atual':'Aguardando'}</span></div></div>`).join('')}</div>`;renderHistory(document.getElementById('client-project-history'),item,p);db.channel(`project-client-${item.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'requests',filter:`id=eq.${item.id}`},()=>location.reload()).subscribe();}
  }
  document.addEventListener('DOMContentLoaded',init);
})();
