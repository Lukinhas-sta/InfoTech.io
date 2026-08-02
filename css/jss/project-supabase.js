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
  const fmtDate=v=>{if(!v)return'A definir';const [y,m,d]=String(v).slice(0,10).split('-').map(Number);return y&&m&&d?new Intl.DateTimeFormat('pt-BR').format(new Date(y,m-1,d)):'A definir'};
  const normalize=(row,legacy)=>{
    const old=legacy&&typeof legacy==='object'?legacy:{};
    const stages=Array.isArray(row?.stages)&&row.stages.length?row.stages:(Array.isArray(old.stages)&&old.stages.length?old.stages:defaults.map((name,i)=>({id:`stage-${i+1}`,name,done:false,doneAt:null})));
    return {deadline:row?.deadline||old.deadline||'',stages,history:Array.isArray(row?.history)?row.history:(Array.isArray(old.history)?old.history:[]),updatedAt:row?.updated_at||old.updatedAt||null};
  };
  const progress=p=>p.stages.length?Math.round(p.stages.filter(s=>s.done).length/p.stages.length*100):0;
  const renderHistory=(el,item,p)=>{if(!el)return;const events=[...p.history];if(item.created_at)events.push({text:'Solicitação criada pelo cliente.',at:item.created_at});events.sort((a,b)=>new Date(b.at)-new Date(a.at));el.innerHTML=events.length?`<ol class="activity-list">${events.slice(0,30).map(e=>`<li class="activity-item"><span class="activity-dot"></span><div class="activity-content"><strong>${esc(e.text)}</strong><span>${fmt(e.at)}</span></div></li>`).join('')}</ol>`:'<div class="project-empty">Ainda não há atividades registradas.</div>';};
  async function init(){
    const req=await db.from('requests').select('id,protocol,status,project,created_at,updated_at').eq('protocol',protocol).maybeSingle();
    const item=req.data;if(req.error||!item)return;
    const rpc=await db.rpc('get_request_project',{p_request_id:item.id});
    const row=Array.isArray(rpc.data)?rpc.data[0]:rpc.data;
    const p=normalize(row,item.project);
    if(row?.status)item.status=row.status;
    const admin=document.getElementById('admin-project-area');
    if(admin){
      const form=document.getElementById('admin-project-form'),deadline=document.getElementById('admin-project-deadline'),stages=document.getElementById('admin-project-stages'),feedback=document.getElementById('admin-project-feedback');
      deadline.value=String(p.deadline||'').slice(0,10);
      const render=()=>{stages.innerHTML=p.stages.map((s,i)=>`<label class="project-stage-admin"><input type="checkbox" data-stage-index="${i}" ${s.done?'checked':''}/><input type="text" maxlength="60" data-stage-name="${i}" value="${esc(s.name)}" aria-label="Nome da etapa ${i+1}"/></label>`).join('');const pct=progress(p);admin.querySelector('[data-admin-project-progress]').textContent=`${pct}%`;admin.querySelector('[data-admin-project-bar]').style.width=`${pct}%`;};
      render();renderHistory(document.getElementById('admin-project-history'),item,p);
      form.addEventListener('submit',async e=>{
        e.preventDefault();
        const now=new Date().toISOString();
        p.deadline=deadline.value||'';
        p.stages.forEach((s,i)=>{const done=stages.querySelector(`[data-stage-index="${i}"]`).checked;const name=stages.querySelector(`[data-stage-name="${i}"]`).value.trim()||s.name;if(done!==s.done)p.history.unshift({id:crypto.randomUUID(),text:done?`Etapa “${name}” concluída.`:`Etapa “${name}” reaberta.`,at:now});s.done=done;s.name=name;s.doneAt=done?(s.doneAt||now):null;});
        p.updatedAt=now;
        const pct=progress(p);
        const status=pct===100?'Concluída':(['Aprovada','Em andamento','Concluída'].includes(item.status)?'Em andamento':item.status);
        feedback.textContent='Salvando andamento...';feedback.className='form-message';
        const result=await db.rpc('admin_save_request_project',{p_request_id:item.id,p_deadline:p.deadline||null,p_stages:p.stages,p_history:p.history,p_status:status});
        const saved=Array.isArray(result.data)?result.data[0]:result.data;
        if(result.error||!saved){feedback.textContent=result.error?.message||'Não foi possível salvar o andamento.';feedback.className='form-message error';return;}
        const verify=await db.rpc('get_request_project',{p_request_id:item.id});
        const confirmed=Array.isArray(verify.data)?verify.data[0]:verify.data;
        if(verify.error||!confirmed){feedback.textContent='O Supabase recebeu a alteração, mas não foi possível confirmá-la.';feedback.className='form-message error';return;}
        const fresh=normalize(confirmed,null);p.deadline=fresh.deadline;p.stages=fresh.stages;p.history=fresh.history;p.updatedAt=fresh.updatedAt;item.status=confirmed.status||status;
        feedback.textContent=`Andamento salvo: ${confirmed.progress}% concluído.`;feedback.className='form-message success';
        deadline.value=String(p.deadline||'').slice(0,10);render();renderHistory(document.getElementById('admin-project-history'),item,p);
      });
    }
    const client=document.getElementById('client-project-area');
    if(client){const pct=progress(p),current=p.stages.find(s=>!s.done);client.innerHTML=`<div class="project-heading"><div><span class="eyebrow">Acompanhamento</span><h2>Andamento do projeto</h2><p>Acompanhe as etapas definidas pela Infotech.</p></div><strong class="project-progress-number">${pct}% concluído</strong></div><div class="project-progress"><span style="width:${pct}%"></span></div><div class="project-meta"><div><span>Status</span><strong>${esc(item.status)}</strong></div><div><span>Previsão de entrega</span><strong>${esc(fmtDate(p.deadline))}</strong></div><div><span>Última atualização</span><strong>${fmt(p.updatedAt||item.updated_at||item.created_at)}</strong></div></div><div class="project-stages">${p.stages.map(s=>`<div class="project-stage ${s.done?'done':current?.id===s.id?'current':''}"><span class="project-stage-dot">${s.done?'✓':''}</span><div><strong>${esc(s.name)}</strong><span>${s.done?'Etapa concluída':current?.id===s.id?'Etapa atual':'Aguardando'}</span></div></div>`).join('')}</div>`;renderHistory(document.getElementById('client-project-history'),item,p);db.channel(`project-client-${item.id}`).on('postgres_changes',{event:'*',schema:'public',table:'request_projects',filter:`request_id=eq.${item.id}`},()=>location.reload()).subscribe();}
  }
  document.addEventListener('DOMContentLoaded',init);
})();
