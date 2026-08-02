(() => {
  const tabs=[...document.querySelectorAll('[data-request-tab]')];
  if(!tabs.length)return;
  const panels=[...document.querySelectorAll('[data-request-panel]')];
  const params=new URLSearchParams(location.search);
  const role=document.body.hasAttribute('data-client-protected')?'client':'admin';
  const requestId=params.get('id');
  const storageKey='infotechDemoRequests';
  const getItem=()=>{try{return (JSON.parse(localStorage.getItem(storageKey))||[]).find(x=>x.id===requestId)}catch{return null}};
  const valid=new Set(tabs.map(t=>t.dataset.requestTab));
  const fromHash=location.hash.replace('#','');
  let initial='conversation';
  if(params.has('arquivo')||/files|arquivo/.test(fromHash))initial='files';
  else if(params.has('mensagem')||/chat|message|conversa/.test(fromHash))initial='conversation';
  else if(/history|historico/.test(fromHash))initial='history';
  else if(/project|projeto/.test(fromHash))initial='project';
  else {
    const item=getItem();
    if(item && ['Aprovada','Em andamento','Concluída'].includes(item.status)) initial='project';
  }
  if(!valid.has(initial))initial=tabs[0].dataset.requestTab;
  const activate=(key,{focus=false,updateHash=false}={})=>{
    tabs.forEach(tab=>{const on=tab.dataset.requestTab===key;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;if(on&&focus)tab.focus()});
    panels.forEach(panel=>{const on=panel.dataset.requestPanel===key;panel.hidden=!on;panel.classList.remove('is-entering');if(on){requestAnimationFrame(()=>panel.classList.add('is-entering'))}});
    if(updateHash)history.replaceState(null,'',`${location.pathname}${location.search}#${key}`);
  };
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>activate(tab.dataset.requestTab,{updateHash:true}));
    tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();let next=index;if(e.key==='ArrowRight')next=(index+1)%tabs.length;if(e.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;activate(tabs[next].dataset.requestTab,{focus:true,updateHash:true})});
  });
  activate(initial);
  // Expose for notification/highlight scripts and manual links.
  window.InfotechRequestTabs={activate};
  // If another script scrolls to a hidden target, reveal the matching panel first.
  document.addEventListener('click',e=>{const link=e.target.closest('a[href*="#"]');if(!link)return;const hash=(link.getAttribute('href').split('#')[1]||'').toLowerCase();if(hash.includes('file')||hash.includes('arquivo'))activate('files');else if(hash.includes('project')||hash.includes('projeto'))activate('project');else if(hash.includes('history')||hash.includes('histor'))activate('history')});
})();
