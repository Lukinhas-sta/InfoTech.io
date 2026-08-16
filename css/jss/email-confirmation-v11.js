(() => {
  'use strict';

  const $=(selector,root=document)=>root.querySelector(selector);
  const normalize=value=>String(value||'').trim();
  const normalizeEmail=value=>normalize(value).toLowerCase();
  const pendingKey='infotech:pending-email-confirmation-v11';
  const resendKey='infotech:last-confirmation-resend-v11';
  const allowedDestinations=new Set(['painel-cliente.html','nova-solicitacao.html','perfil.html']);

  function safeDestination(raw){
    if(!raw)return 'painel-cliente.html';
    try{
      const url=new URL(String(raw),location.href);
      const file=url.pathname.split('/').pop();
      if(!allowedDestinations.has(file))return 'painel-cliente.html';
      if(file==='nova-solicitacao.html'){
        const service=normalize(url.searchParams.get('servico')).slice(0,80);
        return service?`${file}?servico=${encodeURIComponent(service)}`:file;
      }
      return file;
    }catch(_){return 'painel-cliente.html'}
  }

  function maskEmail(value){
    const address=normalizeEmail(value);
    const [local,domain]=address.split('@');
    if(!local||!domain)return 'seu e-mail';
    const visible=local.length<=2?local.slice(0,1):local.slice(0,2);
    const stars='•'.repeat(Math.max(3,Math.min(7,local.length-visible.length)));
    return `${visible}${stars}@${domain}`;
  }

  function providerUrl(value){
    const domain=normalizeEmail(value).split('@')[1]||'';
    if(domain==='gmail.com'||domain==='googlemail.com')return 'https://mail.google.com/mail/u/0/#inbox';
    if(['outlook.com','hotmail.com','live.com','msn.com'].includes(domain))return 'https://outlook.live.com/mail/0/';
    if(domain==='yahoo.com'||domain.endsWith('.yahoo.com'))return 'https://mail.yahoo.com/';
    if(['icloud.com','me.com','mac.com'].includes(domain))return 'https://www.icloud.com/mail/';
    return '';
  }

  function readPending(){
    try{
      const raw=sessionStorage.getItem(pendingKey);
      if(!raw)return null;
      const data=JSON.parse(raw);
      if(!data?.email||Date.now()-Number(data.createdAt||0)>24*60*60*1000)return null;
      return data;
    }catch(_){return null}
  }

  function capturePendingSignup(){
    const form=$('#register-form');
    if(!form)return;
    form.addEventListener('submit',()=>{
      const value=normalizeEmail(form.elements.email?.value);
      if(!value)return;
      const params=new URLSearchParams(location.search);
      const destination=safeDestination(params.get('destino')||localStorage.getItem('infotech:after-confirm'));
      try{sessionStorage.setItem(pendingKey,JSON.stringify({email:value,destination,createdAt:Date.now()}))}catch(_){}
    });
  }

  function revealPendingPanel(){
    const panel=$('#signup-confirmation-panel');
    const form=$('#register-form');
    if(!panel||!form)return;
    const pending=readPending();
    if(!pending)return;

    const card=form.closest('.auth-card');
    card?.classList.add('signup-confirmation-visible');
    panel.hidden=false;

    const emailOut=$('#signup-confirmation-email');
    if(emailOut)emailOut.textContent=maskEmail(pending.email);

    const provider=$('#open-email-provider');
    const href=providerUrl(pending.email);
    if(provider){
      if(href){
        provider.href=href;
        provider.hidden=false;
        const domain=pending.email.split('@')[1]||'';
        provider.textContent=domain.includes('gmail')?'Abrir Gmail':'Abrir caixa de entrada';
      }else{
        provider.hidden=true;
      }
    }

    panel.querySelector('h2')?.focus?.({preventScroll:true});
    panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
  }

  function watchSignupResult(){
    const output=$('#register-message');
    if(!output)return;
    const apply=()=>{
      const text=normalize(output.textContent);
      if(/^Conta criada!\s/i.test(text))revealPendingPanel();
    };
    new MutationObserver(apply).observe(output,{childList:true,characterData:true,subtree:true,attributes:true});
    apply();
  }

  function setupResend(){
    const button=$('#resend-confirmation-email');
    const feedback=$('#signup-confirmation-feedback');
    if(!button)return;

    const setFeedback=(text,type='')=>{
      if(!feedback)return;
      feedback.textContent=text;
      feedback.className=`signup-confirmation-feedback ${type}`.trim();
    };

    button.addEventListener('click',async()=>{
      const pending=readPending();
      if(!pending){setFeedback('Não encontrei o e-mail deste cadastro. Volte e faça o cadastro novamente.','error');return}

      const last=Number(sessionStorage.getItem(resendKey)||0);
      const remaining=Math.ceil((60000-(Date.now()-last))/1000);
      if(remaining>0){setFeedback(`Aguarde ${remaining}s antes de pedir outro e-mail.`);return}

      const db=window.infotechSupabase;
      if(!db?.auth?.resend){setFeedback('A confirmação ainda está carregando. Tente novamente em instantes.','error');return}

      button.disabled=true;
      const original=button.textContent;
      button.textContent='Reenviando...';
      setFeedback('Solicitando um novo link de confirmação...');

      try{
        const destination=safeDestination(pending.destination||localStorage.getItem('infotech:after-confirm'));
        const redirect=new URL(`email-confirmado.html?destino=${encodeURIComponent(destination)}`,location.href).href;
        const {error}=await db.auth.resend({type:'signup',email:pending.email,options:{emailRedirectTo:redirect}});
        if(error)throw error;
        sessionStorage.setItem(resendKey,String(Date.now()));
        setFeedback('Novo e-mail enviado. Confira também a pasta de spam ou promoções.','success');
      }catch(error){
        const text=String(error?.message||'');
        if(/rate|limit|security purposes|seconds/i.test(text))setFeedback('O envio está temporariamente limitado. Aguarde um pouco e tente novamente.','error');
        else setFeedback('Não foi possível reenviar agora. Tente novamente em alguns instantes.','error');
      }finally{
        button.disabled=false;
        button.textContent=original;
      }
    });
  }

  function parseAuthError(){
    const search=new URLSearchParams(location.search);
    const hash=new URLSearchParams(location.hash.replace(/^#/,''));
    const value=name=>search.get(name)||hash.get(name)||'';
    const code=normalize(value('error_code')||value('error'));
    const description=normalize(value('error_description'));
    if(!code&&!description)return null;
    return {code,description};
  }

  function setupConfirmationPage(){
    const root=$('#confirmation-root');
    if(!root)return;

    const status=$('#confirmation-status');
    const action=$('#confirmation-action');
    const auto=$('#confirmation-auto');
    const heading=$('#confirmation-heading');
    const step1=$('[data-confirm-step="1"]');
    const step2=$('[data-confirm-step="2"]');
    const step3=$('[data-confirm-step="3"]');
    const authError=parseAuthError();

    const markSuccess=()=>{
      root.dataset.confirmationState='success';
      step1?.classList.add('is-done');
      step2?.classList.add('is-done');
      step2?.classList.remove('is-active');
      step3?.classList.add('is-active');
    };

    const markError=(message)=>{
      root.dataset.confirmationState='error';
      if(heading)heading.textContent='Este link não pôde ser confirmado.';
      if(status)status.textContent=message;
      if(action){action.textContent='Voltar para entrar';action.href='login.html'}
      auto?.remove();
      step2?.classList.remove('is-active');
      step2?.setAttribute('aria-current','false');
    };

    if(authError){
      const raw=`${authError.code} ${authError.description}`.toLowerCase();
      const expired=/expired|otp_expired|link.*expired/.test(raw);
      const message=expired
        ? 'O link de confirmação expirou. Volte ao cadastro e solicite um novo e-mail.'
        : 'O link é inválido, já foi usado ou não pôde ser verificado. Tente entrar; se necessário, solicite um novo e-mail de confirmação.';
      markError(message);

      // O script principal do site procura especificamente #confirmation-root.
      // Em URLs que já chegam do Auth com erro, removemos esse alvo para impedir
      // que uma sessão antiga seja confundida com a confirmação deste link.
      root.id='confirmation-root-error';
      return;
    }

    if(status){
      const sync=()=>{
        const text=normalize(status.textContent).toLowerCase();
        if(text.includes('e-mail confirmado')||text.includes('conta está pronta'))markSuccess();
      };
      new MutationObserver(sync).observe(status,{childList:true,characterData:true,subtree:true});
      sync();
    }
  }

  capturePendingSignup();
  watchSignupResult();
  setupResend();
  setupConfirmationPage();
})();
