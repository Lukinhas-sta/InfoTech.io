
(() => {
  'use strict';
  const cfg=window.INFOTECH_SUPABASE_CONFIG||{};
  if(!window.supabase?.createClient||!cfg.url||!cfg.publishableKey){console.error('Supabase indisponível');return}
  const db=window.infotechSupabase||window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  window.infotechSupabase=db;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const normalize=v=>String(v||'').trim();
  const email=v=>normalize(v).toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeExternalUrl=v=>{try{const u=new URL(normalize(v));return ['http:','https:'].includes(u.protocol)?u.href:''}catch(_){return ''}};
  const fmt=iso=>iso?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso)):'—';
  const msg=(el,text,type='')=>{if(!el)return;el.textContent=text;el.className=`form-message ${type}`};
  const busy=(form,on)=>{form?.querySelectorAll('button,input,select,textarea').forEach(x=>x.disabled=on);form?.setAttribute('aria-busy',String(on))};
  const params=new URLSearchParams(location.search);
  const allowedDestinations=new Set(['painel-cliente.html','nova-solicitacao.html','perfil.html']);
  function safeDestination(raw){
    if(!raw)return '';
    try{
      const u=new URL(String(raw),location.href);
      const file=u.pathname.split('/').pop();
      if(!allowedDestinations.has(file))return '';
      if(file==='nova-solicitacao.html'){
        const service=normalize(u.searchParams.get('servico')).slice(0,80);
        return service?`${file}?servico=${encodeURIComponent(service)}`:file;
      }
      return file;
    }catch(_){return ''}
  }
  const savedDestination=localStorage.getItem('infotech:after-confirm');
  const destination=safeDestination(params.get('destino'))||safeDestination(savedDestination)||'painel-cliente.html';
  const protectedPage=document.body.hasAttribute('data-client-protected');
  const page=location.pathname.split('/').pop()||'index.html';
  const displayName=u=>normalize(u?.user_metadata?.full_name||u?.user_metadata?.name||u?.email?.split('@')[0]||'Cliente');
  const statusClass=s=>s==='Concluída'?'status-done':s==='Cancelada'?'status-cancelled':['Aprovada','Em andamento'].includes(s)?'status-progress':['Lida','Em análise','Orçamento enviado','Aguardando aprovação','Alteração solicitada'].includes(s)?'status-analysis':'status-sent';
  let currentUser=null;

  function togglePassword(){
    $$('[data-toggle-password]').forEach(btn=>btn.addEventListener('click',()=>{
      const input=document.getElementById(btn.dataset.togglePassword); if(!input)return;
      const show=input.type==='password';input.type=show?'text':'password';btn.textContent=show?'Ocultar':'Mostrar';btn.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');
    }));
  }
  async function profileRole(id){
    if(!id)return null;
    const {data,error}=await db.from('profiles').select('role,is_blocked').eq('id',id).maybeSingle();
    if(error){console.warn('Perfil:',error.message);return null}
    return data;
  }
  async function renderAccount(user){
    currentUser=user||null;
    $$('[data-user-name]').forEach(x=>x.textContent=user?displayName(user):'Cliente');
    $$('[data-user-email]').forEach(x=>x.textContent=user?.email||'');
    const slot=$('.account-slot');
    if(!slot)return;
    if(!user){
      slot.innerHTML='<a class="account-login-link" href="login.html" aria-label="Área do Cliente"><span class="header-person" aria-hidden="true"><i class="hp-head"></i><i class="hp-body"></i><i class="hp-arm hp-left"></i><i class="hp-arm hp-right"></i></span><span>Área do Cliente</span></a>';return;
    }
    const first=esc(displayName(user).split(/\s+/)[0]), full=esc(displayName(user)), em=esc(user.email);
    slot.innerHTML=`<div class="account-nav"><button class="account-trigger" type="button" aria-expanded="false"><span class="account-avatar"><span class="header-person header-person-small" aria-hidden="true"><i class="hp-head"></i><i class="hp-body"></i><i class="hp-arm hp-left"></i><i class="hp-arm hp-right"></i></span></span><span class="account-trigger-text"><small>Olá,</small><strong>${first}</strong></span><span class="account-chevron">⌄</span></button><div class="account-dropdown" hidden><div class="account-summary"><strong>${full}</strong><span>${em}</span></div><a href="painel-cliente.html">Meu painel</a><a href="nova-solicitacao.html">Nova solicitação</a><a href="perfil.html">Meu perfil</a><button class="account-logout" type="button">Sair</button></div></div>`;
    const wrap=$('.account-nav',slot), trigger=$('.account-trigger',slot), dd=$('.account-dropdown',slot);
    trigger?.addEventListener('click',e=>{e.stopPropagation();const open=dd.hidden;dd.hidden=!open;trigger.setAttribute('aria-expanded',String(open))});
    document.addEventListener('click',e=>{if(wrap&&!wrap.contains(e.target)){dd.hidden=true;trigger?.setAttribute('aria-expanded','false')}});
    $('.account-logout',slot)?.addEventListener('click',async()=>{await db.auth.signOut();location.href='index.html'});
    $$('a[href^="login.html?destino="]').forEach(a=>{const q=new URLSearchParams(a.href.split('?')[1]||'');const d=safeDestination(q.get('destino'));if(d)a.href=d});
  }
  async function initAuthState(){
    const {data:{session}}=await db.auth.getSession();
    const user=session?.user||null;
    if(user){
      const p=await profileRole(user.id);
      if(p?.is_blocked){await db.auth.signOut();currentUser=null}else currentUser=user;
    }
    await renderAccount(currentUser);
    if(protectedPage&&!currentUser){const currentTarget=safeDestination(`${page}${location.search}`)||safeDestination(page)||'painel-cliente.html';location.replace(`login.html?destino=${encodeURIComponent(currentTarget)}`)}
    window.dispatchEvent(new CustomEvent('infotech:auth-ready',{detail:{user:currentUser}}));
  }
  function validateStrongPassword(v){
    return v.length>=8 && /[A-Za-z]/.test(v) && /\d/.test(v);
  }
  const signupDraftKey='infotech:signup-draft';
  function saveSignupDraft(emailValue,passwordValue){
    try{sessionStorage.setItem(signupDraftKey,JSON.stringify({email:email(emailValue),password:String(passwordValue||''),destination,createdAt:Date.now()}))}catch(_){}
  }
  function takeSignupDraft(){
    try{
      const raw=sessionStorage.getItem(signupDraftKey);
      sessionStorage.removeItem(signupDraftKey);
      if(!raw)return null;
      const draft=JSON.parse(raw);
      if(!draft?.email||!draft?.password||Date.now()-Number(draft.createdAt||0)>5*60*1000)return null;
      return draft;
    }catch(_){return null}
  }
  function initLogin(){
    const form=$('#login-form');if(!form)return;
    form.addEventListener('submit',async e=>{
      e.preventDefault();const out=$('#login-message');
      if(!form.checkValidity()){form.reportValidity();return}
      busy(form,true);msg(out,'Validando sua conta...','success');
      const loginEmail=email(form.elements.email.value), loginPassword=String(form.elements.password.value||'');
      const {data,error}=await db.auth.signInWithPassword({email:loginEmail,password:loginPassword});
      if(error||!data.user){
        busy(form,false);
        const message=String(error?.message||'');
        const code=String(error?.code||'');
        if(code==='email_not_confirmed'||/email not confirmed/i.test(message)){msg(out,'Confirme seu e-mail antes de entrar.','error');return}
        const invalid=code==='invalid_credentials'||/invalid login credentials|invalid credentials|email or password/i.test(message);
        if(invalid){
          saveSignupDraft(loginEmail,loginPassword);
          msg(out,'Conta não reconhecida com esses dados. Abrindo o cadastro com e-mail e senha preenchidos...','success');
          const dest=safeDestination(params.get('destino'))||'painel-cliente.html';
          setTimeout(()=>location.replace(`cadastro.html?origem=login&destino=${encodeURIComponent(dest)}`),420);
          return;
        }
        msg(out,'Não foi possível validar o acesso agora. Tente novamente.','error');return;
      }
      const p=await profileRole(data.user.id);
      if(p?.is_blocked){await db.auth.signOut();busy(form,false);msg(out,'Esta conta está bloqueada. Entre em contato com a Infotech.','error');return}
      localStorage.removeItem('infotech:after-confirm');msg(out,'Acesso liberado. Abrindo sua área...','success');setTimeout(()=>location.replace(destination),300);
    });
  }
  function initRegister(){
    const form=$('#register-form');if(!form)return;
    const draft=takeSignupDraft();
    if(draft){
      form.elements.email.value=draft.email;
      form.elements.password.value=draft.password;
      form.elements.confirmPassword.value=draft.password;
      const draftDestination=safeDestination(draft.destination);if(draftDestination)localStorage.setItem('infotech:after-confirm',draftDestination);
      const note=document.createElement('div');
      note.className='signup-prefill-note';
      note.innerHTML='E-mail e senha vieram da tentativa de acesso e foram preenchidos só nesta tela. Complete seu nome para criar a conta. Se você já tinha cadastro, use <a href="recuperar-senha.html">recuperar senha</a>.';
      form.parentElement?.insertBefore(note,form);
      form.elements.name?.focus();
      form.elements.password?.dispatchEvent(new Event('input',{bubbles:true}));
    }
    form.addEventListener('submit',async e=>{
      e.preventDefault();const out=$('#register-message');
      if(!form.checkValidity()){form.reportValidity();return}
      const password=String(form.elements.password.value||''), confirm=String(form.elements.confirmPassword.value||'');
      if(!validateStrongPassword(password)){msg(out,'Use ao menos 8 caracteres, incluindo letras e números.','error');return}
      if(password!==confirm){msg(out,'As senhas não coincidem.','error');return}
      busy(form,true);msg(out,'Criando sua conta segura...','success');
      const dest=safeDestination(params.get('destino'))||safeDestination(draft?.destination)||'painel-cliente.html';
      localStorage.setItem('infotech:after-confirm',dest);
      const redirect=new URL(`email-confirmado.html?destino=${encodeURIComponent(dest)}`,location.href).href;
      const {data,error}=await db.auth.signUp({email:email(form.elements.email.value),password,options:{data:{full_name:normalize(form.elements.name.value)},emailRedirectTo:redirect}});
      if(error){
        busy(form,false);
        const m=String(error.message||'');
        if(/already registered|already been registered|user already exists/i.test(m)){msg(out,'Esse e-mail já possui conta. Entre com a senha correta ou use “Esqueci minha senha”.','error');return}
        msg(out,m||'Não foi possível criar a conta.','error');return
      }
      if(data?.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0){
        busy(form,false);msg(out,'Esse e-mail já possui conta. Use “Esqueci minha senha” se não lembrar a senha.','error');return;
      }
      if(data.session){msg(out,'Conta criada e autenticada. Abrindo sua área...','success');setTimeout(()=>location.replace(dest),350);return}
      form.reset();busy(form,false);msg(out,'Conta criada! Abra o e-mail de confirmação. Ao confirmar, você volta para a Infotech automaticamente.','success');
    });
  }
  async function initConfirmation(){
    const root=$('#confirmation-root');if(!root)return;
    const saved=localStorage.getItem('infotech:after-confirm');
    const dest=safeDestination(params.get('destino'))||safeDestination(saved)||'painel-cliente.html';
    const status=$('#confirmation-status'), action=$('#confirmation-action');
    msg(status,'Validando sua confirmação...','success');
    let session=(await db.auth.getSession()).data.session;
    if(!session){
      await new Promise(resolve=>{
        let done=false;
        const {data:sub}=db.auth.onAuthStateChange((_event,s)=>{if(s&&!done){done=true;session=s;sub.subscription.unsubscribe();resolve()}});
        setTimeout(()=>{if(!done){done=true;sub.subscription.unsubscribe();resolve()}},2200);
      });
      session=(await db.auth.getSession()).data.session;
    }
    if(session?.user){
      localStorage.removeItem('infotech:after-confirm');
      msg(status,'E-mail confirmado. Sua conta está pronta!','success');
      action.textContent='Entrar na Área do Cliente';action.href=dest;
      let sec=2;const c=$('#confirmation-countdown');if(c)c.textContent=sec;
      const t=setInterval(()=>{sec--;if(c)c.textContent=Math.max(sec,0);if(sec<=0){clearInterval(t);location.replace(dest)}},1000);
    }else{
      msg(status,'E-mail confirmado. Faça login para continuar.','success');
      action.textContent='Entrar na conta';action.href=`login.html?destino=${encodeURIComponent(dest)}`;
      $('#confirmation-auto')?.remove();
    }
  }
  function initRecovery(){
    const form=$('#recovery-form');if(!form)return;
    const newPass=location.hash.includes('type=recovery')||params.get('mode')==='update';
    $$('[data-recovery-password]').forEach(x=>x.hidden=!newPass);$$('[data-recovery-email]').forEach(x=>x.hidden=newPass);
    form.elements.email.required=!newPass;form.elements.password.required=newPass;form.elements.confirmPassword.required=newPass;
    const button=$('[type="submit"]',form);if(button)button.textContent=newPass?'Salvar nova senha':'Enviar link de recuperação';
    form.addEventListener('submit',async e=>{
      e.preventDefault();const out=$('#recovery-message');
      if(newPass){
        const p=String(form.elements.password.value||''),c=String(form.elements.confirmPassword.value||'');
        if(!validateStrongPassword(p)){msg(out,'Use ao menos 8 caracteres, incluindo letras e números.','error');return}
        if(p!==c){msg(out,'As senhas não coincidem.','error');return}
        busy(form,true);const {error}=await db.auth.updateUser({password:p});busy(form,false);
        if(error){msg(out,error.message||'Não foi possível salvar a senha.','error');return}
        msg(out,'Senha atualizada. Você já pode entrar.','success');setTimeout(async()=>{await db.auth.signOut();location.replace('login.html')},700);
      }else{
        const redirect=new URL('recuperar-senha.html',location.href).href;
        busy(form,true);const {error}=await db.auth.resetPasswordForEmail(email(form.elements.email.value),{redirectTo:redirect});busy(form,false);
        if(error){msg(out,error.message||'Não foi possível enviar o link.','error');return}
        msg(out,'Se este e-mail estiver cadastrado, você receberá o link de recuperação.','success');
      }
    });
  }
  async function initProfile(){
    const profile=$('#profile-form'), password=$('#password-form');if(!profile&&!password)return;
    const user=(await db.auth.getUser()).data.user;if(!user)return;
    if(profile){profile.elements.name.value=displayName(user);profile.elements.email.value=user.email||'';profile.addEventListener('submit',async e=>{e.preventDefault();const out=$('#profile-message');busy(profile,true);const {error}=await db.auth.updateUser({email:email(profile.elements.email.value),data:{full_name:normalize(profile.elements.name.value)}});busy(profile,false);if(error){msg(out,error.message,'error');return}msg(out,'Perfil atualizado. Se o e-mail mudou, confirme o novo endereço.','success')})}
    if(password){password.addEventListener('submit',async e=>{e.preventDefault();const out=$('#password-message'),p=String(password.elements.newPassword.value||''),c=String(password.elements.confirmPassword.value||'');if(!validateStrongPassword(p)){msg(out,'Use ao menos 8 caracteres, incluindo letras e números.','error');return}if(p!==c){msg(out,'As senhas não coincidem.','error');return}busy(password,true);const {error}=await db.auth.updateUser({password:p});busy(password,false);if(error){msg(out,error.message,'error');return}password.reset();msg(out,'Senha alterada com sucesso.','success')})}
  }
  async function current(){return (await db.auth.getUser()).data.user}
  function row(r){return {id:r.protocol,uuid:r.id,userId:r.user_id,title:r.title,service:r.service,description:r.description,deadline:r.deadline,budget:r.budget,contact:r.contact,reference:r.reference_url,status:r.status,adminResponse:r.admin_response,messages:Array.isArray(r.messages)?r.messages:[],project:r.project||{},createdAt:r.created_at,updatedAt:r.updated_at}}
  async function loadRequest(protocol){
    const {data,error}=await db.from('requests').select('*').eq('protocol',protocol).maybeSingle();if(error)throw error;return data?row(data):null;
  }
  function initRequestCreate(){
    const form=$('#request-form');if(!form)return;
    const service=params.get('servico');if(service&&form.elements.service){[...form.elements.service.options].some(o=>o.value.toLowerCase()===service.toLowerCase()&&(form.elements.service.value=o.value,true))}
    form.addEventListener('submit',async e=>{
      e.preventDefault();const out=$('#request-message');if(!form.checkValidity()){form.reportValidity();return}
      const user=await current();if(!user){location.href='login.html?destino=nova-solicitacao.html';return}
      busy(form,true);msg(out,'Registrando sua solicitação...','success');const fd=new FormData(form);
      const {data,error}=await db.from('requests').insert({protocol:'',user_id:user.id,owner_email:user.email,owner_name:displayName(user),title:normalize(fd.get('title')),service:fd.get('service'),description:normalize(fd.get('description')),deadline:fd.get('deadline'),budget:fd.get('budget'),contact:fd.get('contact'),reference_url:safeExternalUrl(fd.get('reference'))||null}).select('protocol').single();
      busy(form,false);if(error){console.error(error);msg(out,'Não foi possível enviar agora. Tente novamente.','error');return}
      sessionStorage.setItem('infotechLastProtocol',data.protocol);location.href='solicitacao-enviada.html';
    });
  }
  async function initSuccess(){const el=$('[data-last-protocol]');if(el)el.textContent='#'+(sessionStorage.getItem('infotechLastProtocol')||'INF-0000')}
  async function initRequestList(){
    const list=$('#requests-list');if(!list)return;
    list.innerHTML='<div class="empty-state">Carregando suas solicitações...</div>';
    const {data,error}=await db.from('requests').select('*').order('created_at',{ascending:false});
    if(error){list.innerHTML='<div class="empty-state">Não foi possível carregar suas solicitações.</div>';return}
    const items=(data||[]).map(row);
    list.innerHTML=items.length?items.map(i=>`<article class="request-card"><div class="request-main"><span class="request-id">#${esc(i.id)}</span><h3>${esc(i.title)}</h3><p>${esc(i.service)} · ${esc(i.description.slice(0,125))}${i.description.length>125?'…':''}</p><div class="request-meta"><span>${fmt(i.createdAt)}</span><span class="status ${statusClass(i.status)}">${esc(i.status)}</span></div></div><a class="btn btn-outline" href="detalhes-solicitacao.html?id=${encodeURIComponent(i.id)}">Acompanhar</a></article>`).join(''):'<div class="empty-state"><h3>Nenhuma solicitação ainda</h3><p>Quando você enviar a primeira, ela aparecerá aqui.</p></div>';
    $$('[data-open-count]').forEach(x=>x.textContent=items.filter(i=>!['Concluída','Cancelada'].includes(i.status)).length);
    $$('[data-response-count]').forEach(x=>x.textContent=items.filter(i=>i.adminResponse).length);
    $$('[data-progress-count]').forEach(x=>x.textContent=items.filter(i=>['Aprovada','Em andamento'].includes(i.status)).length);
  }
  function renderDetail(item){
    const set=(s,v)=>{const el=$(s);if(el)el.textContent=v||'—'};
    set('[data-request-id]','#'+item.id);set('[data-request-title]',item.title);set('[data-request-service]',item.service);set('[data-request-description]',item.description);set('[data-request-deadline]',item.deadline);set('[data-request-budget]',item.budget);set('[data-request-contact]',item.contact);set('[data-request-date]',fmt(item.createdAt));
    const ref=$('[data-request-reference]');if(ref){const safeRef=safeExternalUrl(item.reference);ref.innerHTML=safeRef?`<a href="${esc(safeRef)}" rel="noopener noreferrer" target="_blank">Abrir referência</a>`:'Não informada'};
    const st=$('[data-request-status]');if(st){st.textContent=item.status;st.className=`status ${statusClass(item.status)}`}
    const res=$('#response-content');if(res)res.innerHTML=item.adminResponse?`<div class="response-grid"><div><span>Viabilidade</span><strong>${esc(item.adminResponse.viability||'Em avaliação')}</strong></div><div><span>Valor</span><strong>${esc(item.adminResponse.value||'A combinar')}</strong></div><div><span>Prazo</span><strong>${esc(item.adminResponse.estimatedDeadline||'A combinar')}</strong></div></div><p>${esc(item.adminResponse.response||'')}</p>${item.adminResponse.notes?`<p>${esc(item.adminResponse.notes)}</p>`:''}`:'<div class="empty-state">A equipe ainda está analisando sua solicitação.</div>';
  }
  function renderChat(item){
    const thread=$('#chat-thread');if(!thread)return;
    thread.innerHTML=item.messages.length?item.messages.map(m=>`<article class="chat-message ${m.sender==='client'?'chat-message-client':'chat-message-admin'}"><div class="chat-message-meta"><strong>${esc(m.sender==='client'?(m.senderName||'Você'):'Infotech')}</strong><span>${fmt(m.sentAt)}</span></div><p>${esc(m.text)}</p></article>`).join(''):'<div class="empty-state">Nenhuma mensagem ainda.</div>';thread.scrollTop=thread.scrollHeight;
  }
  async function appendMessage(item,text){
    const user=await current();if(!user)return;
    const messages=[...item.messages,{id:crypto.randomUUID?.()||globalThis.makeId(),sender:'client',senderName:displayName(user),text,sentAt:new Date().toISOString(),readByAdmin:false,readByClient:true}];
    const {error}=await db.from('requests').update({messages}).eq('id',item.uuid);if(error)throw error;item.messages=messages;
  }
  async function renderProject(item){
    const el=$('#project-content');if(!el)return;
    let p=item.project||{};
    const q=await db.from('request_projects').select('deadline,stages,history,progress,updated_at').eq('request_id',item.uuid).maybeSingle();
    if(q.data)p={...p,...q.data,updatedAt:q.data.updated_at};
    const stages=Array.isArray(p.stages)?p.stages:[], pct=Number.isFinite(Number(p.progress))?Number(p.progress):(stages.length?Math.round(stages.filter(s=>s.done).length/stages.length*100):0);
    const currentStage=stages.find(s=>!s.done);
    el.innerHTML=`<div class="project-progress"><span style="width:${pct}%"></span></div><div class="project-meta"><div><span>Progresso</span><strong>${pct}%</strong></div><div><span>Status</span><strong>${esc(item.status)}</strong></div><div><span>Previsão</span><strong>${esc(p.deadline||'A definir')}</strong></div></div><div class="project-stages">${stages.length?stages.map(s=>`<div class="project-stage ${s.done?'done':currentStage?.id===s.id?'current':''}"><span class="project-stage-dot">${s.done?'✓':''}</span><div><strong>${esc(s.name)}</strong><span>${s.done?'Concluída':currentStage?.id===s.id?'Etapa atual':'Aguardando'}</span></div></div>`).join(''):'<div class="empty-state">O acompanhamento será liberado quando o projeto entrar em andamento.</div>'}</div>`;
  }
  async function loadFiles(item){
    const list=$('#attachments-list');if(!list)return;
    const {data,error}=await db.from('request_files').select('*').eq('request_id',item.uuid).order('created_at',{ascending:false});
    if(error){list.innerHTML='<div class="empty-state">Arquivos indisponíveis agora.</div>';return}
    list.innerHTML=(data||[]).length?(data||[]).map(f=>`<div class="attachment"><div><strong>${esc(f.file_name)}</strong><span>${fmt(f.created_at)}</span></div><button type="button" data-file="${esc(f.storage_path)}">Abrir</button></div>`).join(''):'<div class="empty-state">Nenhum arquivo compartilhado.</div>';
    $$('[data-file]',list).forEach(btn=>btn.addEventListener('click',async()=>{const {data:s,error:e}=await db.storage.from('request-files').createSignedUrl(btn.dataset.file,300);if(!e&&s?.signedUrl)window.open(s.signedUrl,'_blank','noopener')}));
  }
  function safeFileName(name){return String(name||'arquivo').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120)}
  async function uploadFiles(item,files,out){
    const user=await current();if(!user)return;
    const selected=[...files].slice(0,3);if(!selected.length)return;
    for(const file of selected){
      if(file.size>10*1024*1024)throw new Error(`${file.name}: limite de 10 MB.`);
      const path=`${user.id}/${item.uuid}/${crypto.randomUUID?.()||globalThis.makeId()}-${safeFileName(file.name)}`;
      const up=await db.storage.from('request-files').upload(path,file,{upsert:false,contentType:file.type||undefined});if(up.error)throw up.error;
      const ins=await db.from('request_files').insert({request_id:item.uuid,uploader_id:user.id,sender:'client',sender_name:displayName(user),file_name:file.name,storage_path:path,mime_type:file.type||null,size_bytes:file.size,read_by_client:true});if(ins.error){await db.storage.from('request-files').remove([path]);throw ins.error}
    }
  }
  async function initRequestDetail(){
    const root=$('#request-detail');if(!root)return;
    const protocol=params.get('id');let item=null;try{item=await loadRequest(protocol)}catch(e){console.error(e)}
    if(!item){root.innerHTML='<div class="empty-state"><h2>Solicitação não encontrada</h2><a class="btn btn-outline" href="painel-cliente.html">Voltar</a></div>';return}
    renderDetail(item);renderChat(item);await renderProject(item);await loadFiles(item);
    $('#chat-form')?.addEventListener('submit',async e=>{e.preventDefault();const input=$('#chat-message'),out=$('#chat-feedback'),text=normalize(input.value);if(!text)return msg(out,'Escreva uma mensagem.','error');busy(e.currentTarget,true);try{await appendMessage(item,text);input.value='';renderChat(item);msg(out,'Mensagem enviada.','success')}catch(err){console.error(err);msg(out,'Não foi possível enviar a mensagem.','error')}finally{busy(e.currentTarget,false)}});
    $('#attachments-form')?.addEventListener('submit',async e=>{e.preventDefault();const input=$('#attachments-input'),out=$('#attachments-feedback');busy(e.currentTarget,true);msg(out,'Enviando...','success');try{await uploadFiles(item,input.files,out);input.value='';await loadFiles(item);msg(out,'Arquivo(s) enviado(s).','success')}catch(err){console.error(err);msg(out,err.message||'Falha no envio.','error')}finally{busy(e.currentTarget,false)}});
    db.channel(`v6-request-${item.uuid}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'requests',filter:`id=eq.${item.uuid}`},async()=>{const fresh=await loadRequest(item.id);if(fresh){item=fresh;renderDetail(item);renderChat(item);await renderProject(item)}}).subscribe();
  }
  async function boot(){
    togglePassword();await initAuthState();initLogin();initRegister();initRecovery();await initConfirmation();await initProfile();initRequestCreate();await initSuccess();await initRequestList();await initRequestDetail();
    $$('[data-logout]').forEach(x=>x.addEventListener('click',async e=>{e.preventDefault();await db.auth.signOut();location.href='index.html'}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
