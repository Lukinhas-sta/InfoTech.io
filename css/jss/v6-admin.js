
(() => {
  'use strict';
  const cfg=window.INFOTECH_SUPABASE_CONFIG||{};
  if(!window.supabase?.createClient||!cfg.url)return;
  const db=window.infotechSupabase||window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce',storageKey:'infotech-admin-auth-v8'}});
  window.infotechSupabase=db;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=iso=>iso?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso)):'—';
  const msg=(el,t,type='')=>{if(el){el.textContent=t;el.className=`form-message ${type}`}};
  const page=location.pathname.split('/').pop()||'admin-login.html';
  const protectedAdmin=!['admin-login.html'].includes(page);
  let user=null;
  async function isAdmin(u){
    if(!u)return false;
    const {data,error}=await db.from('profiles').select('role,is_blocked').eq('id',u.id).maybeSingle();
    return !error&&data?.role==='admin'&&!data?.is_blocked;
  }
  async function mfaInfo(){
    try{
      const [{data:factors,error:factorError},{data:aal,error:aalError}]=await Promise.all([
        db.auth.mfa.listFactors(),db.auth.mfa.getAuthenticatorAssuranceLevel()
      ]);
      if(factorError||aalError)return {verified:[],currentLevel:null};
      const pool=Array.isArray(factors?.all)?factors.all:[...(factors?.totp||[]),...(factors?.phone||[])];
      return {verified:pool.filter(f=>f?.status==='verified'),currentLevel:aal?.currentLevel||null};
    }catch(_){return {verified:[],currentLevel:null}}
  }
  const safeAdminDestination=raw=>{
    const value=String(raw||'');
    return /^(painel-admin|admin-solicitacao|clientes-admin|cliente-admin)\.html(?:\?.*)?$/.test(value)?value:'painel-admin.html';
  };
  async function guard(){
    user=(await db.auth.getSession()).data.session?.user||null;
    const ok=await isAdmin(user);
    if(protectedAdmin&&!ok){location.replace(`admin-login.html?destino=${encodeURIComponent(page+location.search)}`);return false}
    if(!ok)return false;
    const mfa=await mfaInfo();
    if(mfa.verified.length&&mfa.currentLevel!=='aal2'&&page!=='admin-seguranca.html'){
      const dest=safeAdminDestination(page+location.search);
      location.replace(`admin-seguranca.html?mode=challenge&destino=${encodeURIComponent(dest)}`);return false;
    }
    if(page==='admin-login.html'){
      if(mfa.verified.length&&mfa.currentLevel!=='aal2')location.replace('admin-seguranca.html?mode=challenge&destino=painel-admin.html');
      else location.replace('painel-admin.html');
      return false;
    }
    return true;
  }
  function initLogin(){
    const form=$('#admin-login-form');if(!form)return;
    form.addEventListener('submit',async e=>{
      e.preventDefault();const out=$('#admin-login-message');
      form.querySelectorAll('input,button').forEach(x=>x.disabled=true);msg(out,'Validando acesso...','success');
      const {data,error}=await db.auth.signInWithPassword({email:String(form.elements.email.value||'').trim().toLowerCase(),password:String(form.elements.password.value||'')});
      if(error||!data.user){msg(out,'E-mail ou senha incorretos.','error');form.querySelectorAll('input,button').forEach(x=>x.disabled=false);return}
      if(!(await isAdmin(data.user))){await db.auth.signOut();msg(out,'Esta conta não possui permissão administrativa.','error');form.querySelectorAll('input,button').forEach(x=>x.disabled=false);return}
      const dest=safeAdminDestination(new URLSearchParams(location.search).get('destino'));
      const mfa=await mfaInfo();
      if(mfa.verified.length&&mfa.currentLevel!=='aal2'){
        msg(out,'Senha validada. Confirme o segundo fator.','success');
        setTimeout(()=>location.replace(`admin-seguranca.html?mode=challenge&destino=${encodeURIComponent(dest)}`),250);return;
      }
      msg(out,'Acesso autorizado.','success');setTimeout(()=>location.replace(dest),250);
    });
  }
  const row=r=>({id:r.protocol,uuid:r.id,userId:r.user_id,ownerName:r.owner_name,ownerEmail:r.owner_email,title:r.title,service:r.service,description:r.description,deadline:r.deadline,budget:r.budget,contact:r.contact,reference:r.reference_url,status:r.status,adminResponse:r.admin_response,messages:Array.isArray(r.messages)?r.messages:[],project:r.project||{},createdAt:r.created_at,updatedAt:r.updated_at});
  const cls=s=>s==='Concluída'?'status-done':s==='Cancelada'?'status-cancelled':['Aprovada','Em andamento'].includes(s)?'status-progress':['Lida','Em análise','Orçamento enviado','Aguardando aprovação','Alteração solicitada'].includes(s)?'status-analysis':'status-sent';
  async function initDashboard(){
    const list=$('#admin-requests-list');if(!list)return;
    const {data,error}=await db.from('requests').select('*').order('created_at',{ascending:false});
    if(error){list.innerHTML='<div class="empty-state">Falha ao carregar solicitações.</div>';return}
    const items=(data||[]).map(row);
    $('[data-admin-total]').textContent=items.length;$('[data-admin-new]').textContent=items.filter(i=>['Enviada','Lida','Em análise'].includes(i.status)).length;$('[data-admin-progress]').textContent=items.filter(i=>['Aprovada','Em andamento'].includes(i.status)).length;$('[data-admin-done]').textContent=items.filter(i=>i.status==='Concluída').length;
    const search=$('#admin-search'), filter=$('#admin-filter');
    const render=()=>{
      const q=(search?.value||'').toLowerCase(), f=filter?.value||'all';
      const view=items.filter(i=>[i.id,i.ownerName,i.ownerEmail,i.title,i.service].join(' ').toLowerCase().includes(q)&&(f==='all'||i.status===f));
      list.innerHTML=view.length?view.map(i=>`<article class="admin-card"><div><div><span class="request-id">#${esc(i.id)}</span> <span class="status ${cls(i.status)}">${esc(i.status)}</span></div><h3>${esc(i.title)}</h3><p>${esc(i.service)} · ${esc(i.description.slice(0,150))}${i.description.length>150?'…':''}</p><div class="admin-owner">${esc(i.ownerName)} · ${esc(i.ownerEmail)} · ${fmt(i.createdAt)}</div></div><a class="btn btn-outline" href="admin-solicitacao.html?id=${encodeURIComponent(i.id)}">Gerenciar</a></article>`).join(''):'<div class="empty-state">Nenhuma solicitação encontrada.</div>';
    };
    search?.addEventListener('input',render);filter?.addEventListener('change',render);render();
  }
  async function initDetail(){
    const root=$('#admin-detail');if(!root)return;
    const protocol=new URLSearchParams(location.search).get('id');
    const {data,error}=await db.from('requests').select('*').eq('protocol',protocol).maybeSingle();
    if(error||!data){root.innerHTML='<div class="empty-state">Solicitação não encontrada.</div>';return}
    let item=row(data);
    const set=(s,v)=>{const e=$(s);if(e)e.textContent=v||'—'};
    set('[data-id]','#'+item.id);set('[data-title]',item.title);set('[data-owner]',`${item.ownerName} · ${item.ownerEmail}`);set('[data-description]',item.description);set('[data-service]',item.service);set('[data-created]',fmt(item.createdAt));
    const form=$('#admin-response-form');
    if(form){form.elements.status.value=item.status;form.elements.viability.value=item.adminResponse?.viability||'';form.elements.value.value=item.adminResponse?.value||'';form.elements.deadline.value=item.adminResponse?.estimatedDeadline||'';form.elements.response.value=item.adminResponse?.response||'';form.elements.notes.value=item.adminResponse?.notes||'';
      form.addEventListener('submit',async e=>{e.preventDefault();const out=$('#admin-response-message');const adminResponse={viability:form.elements.viability.value,value:form.elements.value.value.trim(),estimatedDeadline:form.elements.deadline.value.trim(),response:form.elements.response.value.trim(),notes:form.elements.notes.value.trim(),sentAt:new Date().toISOString()};const {error}=await db.from('requests').update({status:form.elements.status.value,admin_response:adminResponse}).eq('id',item.uuid);if(error){msg(out,error.message,'error');return}msg(out,'Resposta e status salvos.','success')});
    }
    const chat=$('#admin-chat-thread');
    const drawChat=()=>{chat.innerHTML=item.messages.length?item.messages.map(m=>`<article class="chat-message ${m.sender==='admin'?'chat-message-admin':'chat-message-client'}"><div class="chat-message-meta"><strong>${esc(m.sender==='admin'?'InfoTech':m.senderName||'Cliente')}</strong><span>${fmt(m.sentAt)}</span></div><p>${esc(m.text)}</p></article>`).join(''):'<div class="empty-state">Sem mensagens.</div>';chat.scrollTop=chat.scrollHeight};drawChat();
    $('#admin-chat-form')?.addEventListener('submit',async e=>{e.preventDefault();const input=$('#admin-chat-message'),out=$('#admin-chat-feedback'),text=input.value.trim();if(!text)return;const messages=[...item.messages,{id:crypto.randomUUID?.()||globalThis.makeId(),sender:'admin',senderName:'InfoTech',text,sentAt:new Date().toISOString(),readByAdmin:true,readByClient:false}];const {error}=await db.from('requests').update({messages}).eq('id',item.uuid);if(error){msg(out,error.message,'error');return}item.messages=messages;input.value='';drawChat();msg(out,'Mensagem enviada.','success')});
    // project
    const parea=$('#admin-project-form');
    if(parea){
      const defaults=['Planejamento','Design','Desenvolvimento','Testes','Entrega'];
      let proj={deadline:'',stages:defaults.map((name,i)=>({id:`stage-${i+1}`,name,done:false,doneAt:null})),history:[]};
      const q=await db.from('request_projects').select('*').eq('request_id',item.uuid).maybeSingle();
      if(q.data)proj={deadline:q.data.deadline||'',stages:Array.isArray(q.data.stages)&&q.data.stages.length?q.data.stages:proj.stages,history:Array.isArray(q.data.history)?q.data.history:[]};
      else if(item.project){proj={...proj,...item.project,stages:Array.isArray(item.project.stages)&&item.project.stages.length?item.project.stages:proj.stages}};
      parea.elements.deadline.value=String(proj.deadline||'').slice(0,10);
      const stagebox=$('#admin-stages');
      const drawStages=()=>stagebox.innerHTML=proj.stages.map((s,i)=>`<label class="admin-stage"><input type="checkbox" data-i="${i}" ${s.done?'checked':''}><input type="text" data-name="${i}" maxlength="60" value="${esc(s.name)}"></label>`).join('');
      drawStages();
      $('#admin-project-save')?.addEventListener('click',async e=>{e.preventDefault();const now=new Date().toISOString();proj.deadline=parea.elements.deadline.value||'';proj.stages.forEach((s,i)=>{const done=$(`[data-i="${i}"]`,stagebox).checked,name=$(`[data-name="${i}"]`,stagebox).value.trim()||s.name;if(done!==s.done)proj.history.unshift({id:crypto.randomUUID?.()||globalThis.makeId(),text:done?`Etapa “${name}” concluída.`:`Etapa “${name}” reaberta.`,at:now});s.done=done;s.name=name;s.doneAt=done?(s.doneAt||now):null});const pct=Math.round(proj.stages.filter(s=>s.done).length/proj.stages.length*100);const status=pct===100?'Concluída':'Em andamento';const r=await db.rpc('admin_save_request_project_v2',{p_payload:{request_id:item.uuid,deadline:proj.deadline||null,stages:proj.stages,history:proj.history,status}});if(r.error){msg($('#admin-project-message'),r.error.message,'error');return}msg($('#admin-project-message'),`Andamento salvo: ${pct}% concluído.`,'success')});
    }
  }
  async function initClients(){
    const list=$('#clients-list');if(!list)return;
    const {data,error}=await db.rpc('admin_list_clients');if(error){list.innerHTML='<div class="empty-state">Não foi possível carregar clientes.</div>';return}
    const clients=data||[];const search=$('#client-search');
    const render=()=>{const q=(search?.value||'').toLowerCase();const view=clients.filter(c=>[c.full_name,c.email].join(' ').toLowerCase().includes(q));list.innerHTML=view.map(c=>`<article class="client-row"><div><strong>${esc(c.full_name||'Cliente')}</strong><span>${esc(c.email)} · ${c.email_confirmed_at?'E-mail confirmado':'E-mail pendente'}${c.is_blocked?' · BLOQUEADO':''}</span></div><div class="client-row-actions"><a class="btn btn-outline" href="cliente-admin.html?id=${encodeURIComponent(c.id)}">Ver cliente</a>${c.role!=='admin'?`<button class="btn btn-ghost" data-block="${esc(c.id)}" data-state="${c.is_blocked?'1':'0'}">${c.is_blocked?'Desbloquear':'Bloquear'}</button>`:''}</div></article>`).join('')||'<div class="empty-state">Nenhum cliente.</div>';$$('[data-block]',list).forEach(b=>b.addEventListener('click',async()=>{const blocked=b.dataset.state!=='1';const r=await db.rpc('admin_set_client_blocked',{p_client_id:b.dataset.block,p_blocked:blocked});if(!r.error){const c=clients.find(x=>x.id===b.dataset.block);if(c)c.is_blocked=blocked;render()}}))};search?.addEventListener('input',render);render();
  }
  async function initClientDetail(){
    const root=$('#client-admin-detail');if(!root)return;const id=new URLSearchParams(location.search).get('id');
    const {data:clients}=await db.rpc('admin_list_clients');const c=(clients||[]).find(x=>x.id===id);if(!c){root.innerHTML='<div class="empty-state">Cliente não encontrado.</div>';return}
    $('[data-client-name]').textContent=c.full_name||'Cliente';$('[data-client-email]').textContent=c.email||'—';$('[data-client-status]').textContent=c.is_blocked?'Bloqueado':'Ativo';
    const {data:reqs}=await db.from('requests').select('*').eq('user_id',id).order('created_at',{ascending:false});const list=$('#client-requests');list.innerHTML=(reqs||[]).map(r=>`<article class="admin-card"><div><span class="request-id">#${esc(r.protocol)}</span><h3>${esc(r.title)}</h3><p>${esc(r.service)} · ${esc(r.status)}</p></div><a class="btn btn-outline" href="admin-solicitacao.html?id=${encodeURIComponent(r.protocol)}">Abrir</a></article>`).join('')||'<div class="empty-state">Este cliente ainda não possui solicitações.</div>';
  }
  async function initMfaSecurity(){
    const root=$('#admin-mfa-root');if(!root)return;
    const out=$('#admin-mfa-message'), setup=$('#admin-mfa-setup'), verifyForm=$('#admin-mfa-verify-form');
    const dest=safeAdminDestination(new URLSearchParams(location.search).get('destino'));
    const setStatus=t=>{const el=$('#admin-mfa-status');if(el)el.textContent=t};
    let factorId='';
    const info=await mfaInfo();
    if(info.verified.length){
      factorId=info.verified[0].id;
      if(info.currentLevel==='aal2'){
        setStatus('MFA ativo · sessão verificada');
        if(verifyForm)verifyForm.hidden=true;
        const go=$('#admin-mfa-continue');if(go){go.hidden=false;go.href=dest}
      }else{
        setStatus('MFA ativo · confirme o código para continuar');
        if(verifyForm)verifyForm.hidden=false;
      }
    }else{
      setStatus('MFA ainda não configurado');
      if(setup)setup.hidden=false;
      if(verifyForm)verifyForm.hidden=true;
    }
    $('#admin-mfa-enroll')?.addEventListener('click',async()=>{
      msg(out,'Gerando seu segundo fator...','success');
      const {data,error}=await db.auth.mfa.enroll({factorType:'totp',friendlyName:'InfoTech Admin'});
      if(error){msg(out,error.message||'Não foi possível iniciar o MFA.','error');return}
      factorId=data.id;
      const qr=$('#admin-mfa-qr');if(qr&&data?.totp?.qr_code){qr.src=data.totp.qr_code;qr.hidden=false}
      const secret=$('#admin-mfa-secret');if(secret)secret.textContent=data?.totp?.secret||'';
      if(verifyForm)verifyForm.hidden=false;
      msg(out,'Escaneie o QR no autenticador e confirme o código de 6 dígitos.','success');
    });
    verifyForm?.addEventListener('submit',async e=>{
      e.preventDefault();const code=String(verifyForm.elements.code.value||'').replace(/\D/g,'').slice(0,6);
      if(code.length!==6){msg(out,'Digite os 6 números do autenticador.','error');return}
      if(!factorId){const fresh=await mfaInfo();factorId=fresh.verified[0]?.id||''}
      if(!factorId){msg(out,'Fator MFA não encontrado. Gere um novo QR.','error');return}
      verifyForm.querySelectorAll('input,button').forEach(x=>x.disabled=true);
      const {error}=await db.auth.mfa.challengeAndVerify({factorId,code});
      verifyForm.querySelectorAll('input,button').forEach(x=>x.disabled=false);
      if(error){msg(out,'Código inválido ou expirado. Tente novamente.','error');return}
      msg(out,'Segundo fator confirmado. Abrindo o painel...','success');
      setTimeout(()=>location.replace(dest),350);
    });
  }
  async function boot(){const ok=await guard();initLogin();if(!protectedAdmin||ok){await initMfaSecurity();await initDashboard();await initDetail();await initClients();await initClientDetail()}$$('[data-admin-logout]').forEach(x=>x.addEventListener('click',async e=>{e.preventDefault();await db.auth.signOut();location.replace('admin-login.html')}))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
