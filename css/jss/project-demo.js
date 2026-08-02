(() => {
  const KEY='infotechDemoRequests';
  const read=()=>{try{const v=JSON.parse(localStorage.getItem(KEY));return Array.isArray(v)?v:[]}catch{return[]}};
  const save=v=>{try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}};
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt=iso=>{try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso))}catch{return'Data não informada'}};
  const fmtDate=value=>{try{const [year,month,day]=String(value||'').split('-').map(Number);if(!year||!month||!day)return'A definir';return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short'}).format(new Date(year,month-1,day))}catch{return String(value||'A definir')}};
  const params=new URLSearchParams(location.search), id=params.get('id');
  if(!id)return;
  const items=read(), item=items.find(x=>x.id===id); if(!item)return;
  const defaults=['Planejamento','Design','Desenvolvimento','Testes','Entrega'];
  item.project=item.project||{};
  item.project.stages=Array.isArray(item.project.stages)&&item.project.stages.length?item.project.stages:defaults.map((name,i)=>({id:`stage-${i+1}`,name,done:false,doneAt:null}));
  item.project.history=Array.isArray(item.project.history)?item.project.history:[];
  const addHistory=(text,type='update')=>{item.project.history.unshift({id:`EV-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,text,type,at:new Date().toISOString()})};
  const derivedHistory=()=>{
    const events=[];
    if(item.createdAt)events.push({text:'Solicitação criada pelo cliente.',at:item.createdAt});
    if(item.adminResponse?.sentAt)events.push({text:'A Infotech enviou uma resposta ou orçamento.',at:item.adminResponse.sentAt});
    if(item.proposalDecision?.decidedAt){const labels={accepted:'Cliente aprovou o orçamento.',rejected:'Cliente recusou o orçamento.',change_requested:'Cliente solicitou alteração no orçamento.'};events.push({text:labels[item.proposalDecision.type]||'Cliente registrou uma decisão.',at:item.proposalDecision.decidedAt})}
    (item.messages||[]).forEach(m=>events.push({text:m.sender==='client'?'Cliente enviou uma mensagem.':'Infotech enviou uma mensagem.',at:m.sentAt}));
    (item.attachments||[]).forEach(a=>events.push({text:`${a.sender==='client'?'Cliente':'Infotech'} enviou o arquivo “${a.name}”.`,at:a.sentAt||a.createdAt}));
    return [...item.project.history,...events].filter(e=>e.at).sort((a,b)=>new Date(b.at)-new Date(a.at));
  };
  const renderHistory=(el)=>{const events=derivedHistory();el.innerHTML=events.length?`<ol class="activity-list">${events.slice(0,30).map(e=>`<li class="activity-item"><span class="activity-dot"></span><div class="activity-content"><strong>${esc(e.text)}</strong><span>${fmt(e.at)}</span></div></li>`).join('')}</ol>`:'<div class="project-empty">Ainda não há atividades registradas.</div>'};
  const progress=()=>Math.round(item.project.stages.filter(s=>s.done).length/item.project.stages.length*100);
  const statusAllowed=['Aprovada','Em andamento','Concluída'];

  const client=document.getElementById('client-project-area');
  if(client){
    if(!statusAllowed.includes(item.status))client.innerHTML='<div class="project-empty"><strong>O projeto ainda não foi iniciado.</strong><p>Esta área será liberada depois que o orçamento for aprovado e a Infotech iniciar o trabalho.</p></div>';
    else{
      const pct=progress(), current=item.project.stages.find(s=>!s.done);
      client.innerHTML=`<div class="project-heading"><div><span class="eyebrow">Acompanhamento</span><h2>Andamento do projeto</h2><p>Acompanhe as etapas definidas pela Infotech.</p></div><strong class="project-progress-number">${pct}% concluído</strong></div><div class="project-progress"><span style="width:${pct}%"></span></div><div class="project-meta"><div><span>Status</span><strong>${esc(item.status)}</strong></div><div><span>Previsão de entrega</span><strong>${esc(fmtDate(item.project.deadline))}</strong></div><div><span>Última atualização</span><strong>${fmt(item.project.updatedAt||item.updatedAt||item.createdAt)}</strong></div></div><div class="project-stages">${item.project.stages.map(s=>`<div class="project-stage ${s.done?'done':current?.id===s.id?'current':''}"><span class="project-stage-dot">${s.done?'✓':''}</span><div><strong>${esc(s.name)}</strong><span>${s.done?'Etapa concluída':current?.id===s.id?'Etapa atual':'Aguardando'}</span></div></div>`).join('')}</div>`;
    }
    const hist=document.getElementById('client-project-history'); if(hist)renderHistory(hist);
  }

  const admin=document.getElementById('admin-project-area');
  if(admin){
    const form=document.getElementById('admin-project-form'), deadline=document.getElementById('admin-project-deadline'), stages=document.getElementById('admin-project-stages'), feedback=document.getElementById('admin-project-feedback');
    deadline.value=item.project.deadline||'';
    const renderAdmin=()=>{stages.innerHTML=item.project.stages.map((s,i)=>`<label class="project-stage-admin"><input type="checkbox" data-stage-index="${i}" ${s.done?'checked':''}/><input type="text" maxlength="60" data-stage-name="${i}" value="${esc(s.name)}" aria-label="Nome da etapa ${i+1}"/></label>`).join('');const pct=progress();admin.querySelector('[data-admin-project-progress]').textContent=`${pct}%`;admin.querySelector('[data-admin-project-bar]').style.width=`${pct}%`};
    renderAdmin();
    form.addEventListener('submit',e=>{e.preventDefault();const now=new Date().toISOString();item.project.deadline=deadline.value.trim();item.project.stages.forEach((s,i)=>{const done=stages.querySelector(`[data-stage-index="${i}"]`).checked;const name=stages.querySelector(`[data-stage-name="${i}"]`).value.trim()||s.name;if(done&&!s.done){s.doneAt=now;addHistory(`Etapa “${name}” concluída.`,'stage')} if(!done&&s.done){s.doneAt=null;addHistory(`Etapa “${name}” foi reaberta.`,'stage')}s.done=done;s.name=name});item.project.updatedAt=now;item.updatedAt=now;if(progress()===100)item.status='Concluída';else if(statusAllowed.includes(item.status))item.status='Em andamento';save(items);feedback.textContent='Andamento do projeto atualizado. O cliente já pode visualizar.';feedback.className='form-message success';renderAdmin();const hist=document.getElementById('admin-project-history');if(hist)renderHistory(hist)});
    const hist=document.getElementById('admin-project-history');if(hist)renderHistory(hist);
  }
})();
