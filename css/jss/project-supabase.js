(() => {
  'use strict';
  const makeId=()=>{
    if(globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function')return globalThis.crypto.randomUUID();
    const bytes=new Uint8Array(16);
    if(globalThis.crypto&&typeof globalThis.crypto.getRandomValues==='function')globalThis.crypto.getRandomValues(bytes);
    else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0'));
    return `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10).join('')}`;
  };
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
  const baseStages=()=>defaults.map((name,i)=>({id:`stage-${i+1}`,name,done:false,doneAt:null}));
  const normalize=(row,legacy)=>{
    const old=legacy&&typeof legacy==='object'?legacy:{};
    const source=Array.isArray(row?.stages)&&row.stages.length?row.stages:(Array.isArray(old.stages)&&old.stages.length?old.stages:baseStages());
    const stages=source.map((s,i)=>({id:s.id||`stage-${i+1}`,name:s.name||defaults[i]||`Etapa ${i+1}`,done:s.done===true,doneAt:s.doneAt||s.done_at||null}));
    return {deadline:row?.deadline||old.deadline||'',stages,history:Array.isArray(row?.history)?row.history:(Array.isArray(old.history)?old.history:[]),updatedAt:row?.updated_at||old.updatedAt||null};
  };
  const progress=p=>p.stages.length?Math.round(p.stages.filter(s=>s.done).length/p.stages.length*100):0;
  const renderHistory=(el,item,p)=>{if(!el)return;const events=[...p.history];if(item.created_at)events.push({text:'Solicitação criada pelo cliente.',at:item.created_at});events.sort((a,b)=>new Date(b.at)-new Date(a.at));el.innerHTML=events.length?`<ol class="activity-list">${events.slice(0,30).map(e=>`<li class="activity-item"><span class="activity-dot"></span><div class="activity-content"><strong>${esc(e.text)}</strong><span>${fmt(e.at)}</span></div></li>`).join('')}</ol>`:'<div class="project-empty">Ainda não há atividades registradas.</div>';};
  async function loadProject(request){
    const q=await db.from('request_projects').select('request_id,deadline,stages,history,progress,updated_at').eq('request_id',request.id).maybeSingle();
    if(q.error && q.error.code!=='PGRST116') console.warn('Falha ao ler progresso:',q.error);
    return normalize(q.data,request.project);
  }
  async function init(){
    const req=await db.from('requests').select('id,protocol,status,project,created_at,updated_at').eq('protocol',protocol).maybeSingle();
    const item=req.data;if(req.error||!item)return;
    const p=await loadProject(item);
    const admin=document.getElementById('admin-project-area');
    if(admin){
      const box=document.getElementById('admin-project-form'),deadline=document.getElementById('admin-project-deadline'),stages=document.getElementById('admin-project-stages'),feedback=document.getElementById('admin-project-feedback'),saveBtn=document.getElementById('admin-project-save');
      deadline.value=String(p.deadline||'').slice(0,10);
      const render=()=>{stages.innerHTML=p.stages.map((s,i)=>`<label class="project-stage-admin"><input type="checkbox" data-stage-index="${i}" ${s.done?'checked':''}/><input type="text" maxlength="60" data-stage-name="${i}" value="${esc(s.name)}" aria-label="Nome da etapa ${i+1}"/></label>`).join('');const pct=progress(p);admin.querySelector('[data-admin-project-progress]').textContent=`${pct}%`;admin.querySelector('[data-admin-project-bar]').style.width=`${pct}%`;};
      render();renderHistory(document.getElementById('admin-project-history'),item,p);
      const saveProject=async()=>{
        if(saveBtn.disabled)return;
        saveBtn.disabled=true;
        const original=saveBtn.textContent;
        saveBtn.textContent='Salvando...';
        feedback.textContent='Salvando andamento no Supabase...';feedback.className='form-message';
        try{
          const now=new Date().toISOString();
          p.deadline=deadline.value||'';
          p.stages.forEach((s,i)=>{
            const checkbox=stages.querySelector(`[data-stage-index="${i}"]`);
            const nameInput=stages.querySelector(`[data-stage-name="${i}"]`);
            const done=Boolean(checkbox?.checked);
            const name=(nameInput?.value||'').trim()||s.name;
            if(done!==s.done)p.history.unshift({id:makeId(),text:done?`Etapa “${name}” concluída.`:`Etapa “${name}” reaberta.`,at:now});
            s.done=done;s.name=name;s.doneAt=done?(s.doneAt||now):null;
          });
          const pct=progress(p);
          const status=pct===100?'Concluída':(['Aprovada','Em andamento','Concluída'].includes(item.status)?'Em andamento':item.status);
          const payload={request_id:item.id,deadline:p.deadline||null,stages:p.stages,history:p.history,status};
          const result=await db.rpc('admin_save_request_project_v2',{p_payload:payload});
          if(result.error)throw result.error;
          const confirmed=Array.isArray(result.data)?result.data[0]:result.data;
          if(!confirmed||confirmed.request_id!==item.id)throw new Error('O Supabase não confirmou o registro atualizado.');
          const fresh=await loadProject(item);
          p.deadline=fresh.deadline;p.stages=fresh.stages;p.history=fresh.history;p.updatedAt=fresh.updatedAt;item.status=confirmed.status||status;
          deadline.value=String(p.deadline||'').slice(0,10);render();renderHistory(document.getElementById('admin-project-history'),item,p);
          feedback.textContent=`Andamento salvo e confirmado: ${progress(p)}% concluído.`;feedback.className='form-message success';
        }catch(error){
          console.error(error);
          feedback.textContent=error?.message||'Não foi possível salvar o andamento.';feedback.className='form-message error';
        }finally{saveBtn.disabled=false;saveBtn.textContent=original;}
      };
      // O andamento não usa mais submit de formulário, evitando qualquer redirecionamento.
      saveBtn?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();saveProject();});
      box?.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.tagName!=='TEXTAREA'){e.preventDefault();}});
    }
    const client=document.getElementById('client-project-area');
    if(client){
      const draw=async()=>{const latest=await loadProject(item);const pct=progress(latest),current=latest.stages.find(s=>!s.done);client.innerHTML=`<div class="project-heading"><div><span class="eyebrow">Acompanhamento</span><h2>Andamento do projeto</h2><p>Acompanhe as etapas definidas pela Infotech.</p></div><strong class="project-progress-number">${pct}% concluído</strong></div><div class="project-progress"><span style="width:${pct}%"></span></div><div class="project-meta"><div><span>Status</span><strong>${esc(item.status)}</strong></div><div><span>Previsão de entrega</span><strong>${esc(fmtDate(latest.deadline))}</strong></div><div><span>Última atualização</span><strong>${fmt(latest.updatedAt||item.updated_at||item.created_at)}</strong></div></div><div class="project-stages">${latest.stages.map(s=>`<div class="project-stage ${s.done?'done':current?.id===s.id?'current':''}"><span class="project-stage-dot">${s.done?'✓':''}</span><div><strong>${esc(s.name)}</strong><span>${s.done?'Etapa concluída':current?.id===s.id?'Etapa atual':'Aguardando'}</span></div></div>`).join('')}</div>`;renderHistory(document.getElementById('client-project-history'),item,latest);};
      await draw();
      db.channel(`project-client-${item.id}`).on('postgres_changes',{event:'*',schema:'public',table:'request_projects',filter:`request_id=eq.${item.id}`},draw).subscribe();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
