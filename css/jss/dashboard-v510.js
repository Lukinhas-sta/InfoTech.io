(() => {
  'use strict';
  const cfg = window.INFOTECH_SUPABASE_CONFIG;
  if (!cfg || !window.supabase) return;
  const db = window.infotechSupabase || window.supabase.createClient(cfg.url, cfg.publishableKey);
  window.infotechSupabase = db;
  const $ = (s,r=document)=>r.querySelector(s);
  const esc = (v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = iso => iso ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso)) : 'Sem data';
  const norm = v => String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const set = (s,v)=>document.querySelectorAll(s).forEach(e=>e.textContent=String(v));
  const safeQuery = async promise => { try { const r=await promise; return r.error ? {data:[],error:r.error}:{data:r.data||[],error:null}; } catch(error){ return {data:[],error}; } };

  async function init(){
    const root=$('[data-v510-status-chart]'); if(!root) return;
    const requestsResult=await safeQuery(db.from('requests').select('id,protocol,owner_name,owner_email,title,service,status,messages,created_at,updated_at').order('updated_at',{ascending:false}));
    const profilesResult=await safeQuery(db.from('profiles').select('id,email,full_name,role,created_at'));
    const filesResult=await safeQuery(db.from('request_files').select('id,request_id,created_at'));
    const eventsResult=await safeQuery(db.from('request_events').select('id,title,description,created_at,request_id').order('created_at',{ascending:false}).limit(8));
    const requests=requestsResult.data;
    const profiles=profilesResult.data;
    const files=filesResult.data;
    const messageCount=requests.reduce((n,r)=>n+(Array.isArray(r.messages)?r.messages.length:0),0);
    const clients=profiles.filter(p=>p.role!=='admin');
    const active=requests.filter(r=>['Aprovada','Em andamento'].includes(r.status));
    set('[data-v510-clients]',clients.length);
    set('[data-v510-active]',active.length);
    set('[data-v510-messages]',messageCount);
    set('[data-v510-files]',files.length);

    const statuses=['Enviada','Em análise','Orçamento enviado','Aguardando aprovação','Aprovada','Em andamento','Concluída','Cancelada'];
    const counts=statuses.map(status=>({status,count:requests.filter(r=>r.status===status).length})).filter(x=>x.count>0);
    const max=Math.max(1,...counts.map(x=>x.count));
    root.innerHTML=counts.length?counts.map(x=>`<div class="dashboard-chart-row"><span class="dashboard-chart-label">${esc(x.status)}</span><div class="dashboard-chart-track"><div class="dashboard-chart-fill" style="width:${Math.max(4,(x.count/max)*100)}%"></div></div><span class="dashboard-chart-value">${x.count}</span></div>`).join(''):'<div class="dashboard-recent-item"><span>Nenhuma solicitação disponível.</span></div>';

    const recent=$('[data-v510-recent]');
    const events=eventsResult.data;
    if(events.length){recent.innerHTML=events.slice(0,6).map(e=>`<article class="dashboard-recent-item"><strong>${esc(e.title||'Atividade registrada')}</strong><span>${esc(e.description||'Sem detalhes')} · ${fmt(e.created_at)}</span></article>`).join('');}
    else{recent.innerHTML=requests.slice(0,6).map(r=>`<article class="dashboard-recent-item"><strong>#${esc(r.protocol||'')} · ${esc(r.title||r.service||'Solicitação')}</strong><span>${esc(r.status||'Enviada')} · Atualizada em ${fmt(r.updated_at||r.created_at)}</span></article>`).join('')||'<div class="dashboard-recent-item"><span>Nenhuma atividade recente.</span></div>';}

    const health=$('[data-v510-health]'); const healthText=$('[data-v510-health-text]');
    const errors=[requestsResult.error,profilesResult.error].filter(Boolean);
    if(errors.length){health?.classList.add('is-warning'); if(health?.querySelector('strong'))health.querySelector('strong').textContent='Atenção necessária'; if(healthText)healthText.textContent='Alguns dados não puderam ser carregados. Verifique as permissões do Supabase.';}
    else{if(health?.querySelector('strong'))health.querySelector('strong').textContent='Sistema conectado'; if(healthText)healthText.textContent=`${requests.length} solicitações e ${clients.length} clientes disponíveis.`;}

    const input=$('#dashboard-global-search'); const results=$('[data-v510-search-results]');
    const renderSearch=()=>{
      const q=norm(input?.value);
      if(!q){results.innerHTML='<div class="dashboard-recent-item"><span>Comece a digitar para pesquisar no sistema.</span></div>';return;}
      const requestMatches=requests.filter(r=>norm([r.protocol,r.owner_name,r.owner_email,r.title,r.service].join(' ')).includes(q)).slice(0,6).map(r=>({type:'Solicitação',title:`#${r.protocol} · ${r.title||r.service}`,sub:`${r.owner_name||r.owner_email} · ${r.status}`,href:`admin-solicitacao.html?id=${encodeURIComponent(r.protocol||'')}`}));
      const clientMatches=clients.filter(c=>norm([c.full_name,c.email].join(' ')).includes(q)).slice(0,5).map(c=>({type:'Cliente',title:c.full_name||c.email,sub:c.email,href:`cliente-admin.html?id=${encodeURIComponent(c.id||'')}`}));
      const all=[...requestMatches,...clientMatches].slice(0,10);
      results.innerHTML=all.length?all.map(x=>`<a class="dashboard-search-result" href="${esc(x.href)}"><div><span class="dashboard-result-type">${esc(x.type)}</span><strong>${esc(x.title)}</strong><span>${esc(x.sub)}</span></div><span aria-hidden="true">→</span></a>`).join(''):'<div class="dashboard-recent-item"><span>Nenhum resultado encontrado.</span></div>';
    };
    input?.addEventListener('input',renderSearch);
  }
  document.addEventListener('DOMContentLoaded',init);
})();
