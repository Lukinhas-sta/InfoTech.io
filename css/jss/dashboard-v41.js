(() => {
  const requestKey = 'infotechDemoRequests';
  const userKey = 'infotechDemoUser';
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const requests = readJson(requestKey, []);
  const user = readJson(userKey, {});
  const normalize = value => String(value || '').trim().toLowerCase();
  const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const formatDate = iso => { try { return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso)); } catch { return 'Data não informada'; } };
  const icon = path => `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${path}"></path></svg>`;
  const icons = {
    bell:'M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5-6.71V3a2 2 0 0 0-4 0v1.29A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2z',
    message:'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 2-2z',
    file:'M6 2h8l5 5v15H6V2zm7 1.5V8h4.5L13 3.5z',
    progress:'M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8V2zm1 5h-2v6l5 3 1-1.7-4-2.3V7z',
    check:'M9 16.2 4.8 12 3.4 13.4 9 19 21 7l-1.4-1.4L9 16.2z',
    user:'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14z',
    attachment:'M16.5 6.5 8.91 14.09a2 2 0 1 0 2.83 2.83l7.07-7.07a4 4 0 0 0-5.66-5.66L5.37 11.97a6 6 0 1 0 8.49 8.49l6.36-6.36-1.42-1.42-6.36 6.36a4 4 0 1 1-5.66-5.66l7.78-7.78a2 2 0 0 1 2.83 2.83l-7.07 7.07a.01.01 0 0 1-.01.01l-1.4-1.42 7.59-7.59z'
  };
  const clientPage = document.querySelector('.dashboard-shell:not(.admin-dashboard)');
  const adminPage = document.querySelector('.admin-dashboard');

  const installNotifications = (welcome, notifications, label) => {
    if (!welcome || welcome.querySelector('.notification-center')) return;
    const oldAction = welcome.querySelector(':scope > .btn');
    const toolbar = document.createElement('div');
    toolbar.className = 'dashboard-toolbar';
    if (oldAction) toolbar.appendChild(oldAction);
    const center = document.createElement('div');
    center.className = 'notification-center';
    center.innerHTML = `<button class="notification-trigger" type="button" aria-expanded="false" aria-label="Abrir notificações">${icon(icons.bell)}${notifications.length ? `<span class="notification-badge">${Math.min(notifications.length,99)}</span>`:''}</button><div class="notification-panel" hidden><div class="notification-head"><h3>Notificações</h3><span>${escapeHtml(label)}</span></div><div class="notification-list">${notifications.length ? notifications.map(note => `<a class="notification-item" href="${note.href}"><span class="notification-icon">${icon(note.icon || icons.message)}</span><span class="notification-copy"><strong>${escapeHtml(note.title)}</strong><p>${escapeHtml(note.text)}</p><time>${formatDate(note.date)}</time></span></a>`).join('') : '<div class="notification-empty">Nenhuma notificação nova.</div>'}</div></div>`;
    toolbar.appendChild(center);
    welcome.appendChild(toolbar);
    const trigger = center.querySelector('.notification-trigger');
    const panel = center.querySelector('.notification-panel');
    const close = () => { panel.hidden = true; center.classList.remove('open'); trigger.setAttribute('aria-expanded','false'); };
    trigger.addEventListener('click', e => { e.stopPropagation(); const open = panel.hidden; panel.hidden = !open; center.classList.toggle('open',open); trigger.setAttribute('aria-expanded',String(open)); });
    document.addEventListener('click', e => { if (!center.contains(e.target)) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  };

  const addStatIcons = (root, paths) => {
    root?.querySelectorAll(':scope > article').forEach((article,index) => {
      if (article.querySelector('.dashboard-stat-icon')) return;
      const badge = document.createElement('span'); badge.className='dashboard-stat-icon'; badge.innerHTML=icon(paths[index] || icons.file); article.prepend(badge);
    });
    root?.classList.add('dashboard-stats-v41');
  };

  const renderActivities = (items, admin=false) => {
    const activities=[];
    items.forEach(item => {
      activities.push({date:item.createdAt,title:`${admin ? (item.ownerName || 'Cliente') + ' criou' : 'Solicitação criada'}: ${item.title}`,text:`${item.id} · ${item.service}`,icon:icons.file,href:`${admin?'admin-solicitacao':'detalhes-solicitacao'}.html?id=${encodeURIComponent(item.id)}`});
      if (item.adminResponse?.sentAt) activities.push({date:item.adminResponse.sentAt,title:admin?'Orçamento atualizado':'Resposta da Infotech recebida',text:`${item.id} · ${item.status}`,icon:icons.check,href:`${admin?'admin-solicitacao':'detalhes-solicitacao'}.html?id=${encodeURIComponent(item.id)}`});
      (Array.isArray(item.messages)?item.messages:[]).slice(-3).forEach(msg => activities.push({date:msg.sentAt,title:msg.sender==='admin'?'Mensagem da Infotech':`Mensagem de ${msg.senderName || 'cliente'}`,text:`Conversa em ${item.id}`,icon:icons.message,href:`${admin?'admin-solicitacao':'detalhes-solicitacao'}.html?id=${encodeURIComponent(item.id)}`}));
    });
    return activities.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  };

  const insertDashboardDetails = (content, items, admin=false) => {
    if (!content || content.querySelector('.dashboard-two-column')) return;
    const activities=renderActivities(items,admin);
    const total=Math.max(items.length,1);
    const analysis=items.filter(i=>['Enviada','Lida','Em análise','Orçamento enviado','Aguardando aprovação','Alteração solicitada'].includes(i.status)).length;
    const progress=items.filter(i=>['Aprovada','Em andamento'].includes(i.status)).length;
    const done=items.filter(i=>i.status==='Concluída').length;
    const block=document.createElement('div'); block.className='dashboard-two-column';
    block.innerHTML=`<section class="activity-card"><div class="activity-card-head"><div><span class="eyebrow">Movimentações</span><h2>Atividades recentes</h2></div></div>${activities.length?`<ol class="activity-list">${activities.map(a=>`<li class="activity-item"><span class="activity-dot">${icon(a.icon)}</span><span class="activity-copy"><strong>${escapeHtml(a.title)}</strong><p>${escapeHtml(a.text)}</p><time>${formatDate(a.date)}</time></span></li>`).join('')}</ol>`:'<div class="activity-empty">As atividades aparecerão aqui conforme o sistema for usado.</div>'}</section><section class="quick-overview-card"><span class="eyebrow">Distribuição</span><h2>Visão dos atendimentos</h2><div class="overview-bars"><div><div class="overview-row-head"><span>Em análise</span><strong>${analysis}</strong></div><div class="overview-track"><span class="overview-fill yellow" style="width:${analysis/total*100}%"></span></div></div><div><div class="overview-row-head"><span>Em andamento</span><strong>${progress}</strong></div><div class="overview-track"><span class="overview-fill" style="width:${progress/total*100}%"></span></div></div><div><div class="overview-row-head"><span>Concluídas</span><strong>${done}</strong></div><div class="overview-track"><span class="overview-fill green" style="width:${done/total*100}%"></span></div></div></div><p class="dashboard-mini-note">Os indicadores são atualizados automaticamente com os dados de demonstração salvos neste navegador.</p></section>`;
    const stats=content.querySelector('.dashboard-stats');
    stats?.insertAdjacentElement('afterend',block);
  };

  if (clientPage && user.email) {
    const items=requests.filter(item=>normalize(item.ownerEmail)===normalize(user.email));
    const notifications=[];
    items.forEach(item=>{
      const unread=(Array.isArray(item.messages)?item.messages:[]).filter(m=>m.sender==='admin'&&!m.readByClient);
      unread.forEach(m=>notifications.push({title:'Nova mensagem da Infotech',text:`${item.id} · ${m.text.slice(0,75)}`,date:m.sentAt,href:`detalhes-solicitacao.html?id=${encodeURIComponent(item.id)}&mensagem=${encodeURIComponent(m.id)}`,icon:icons.message}));
      (Array.isArray(item.attachments)?item.attachments:[]).filter(file=>file.sender==='admin'&&!file.readByClient).forEach(file=>notifications.push({title:'Novo arquivo da Infotech',text:`${item.id} · ${file.name}`,date:file.sentAt,href:`detalhes-solicitacao.html?id=${encodeURIComponent(item.id)}&arquivo=${encodeURIComponent(file.id)}#files`,icon:icons.attachment}));
      if(item.adminResponse?.sentAt && !item.adminResponse.readByClient) notifications.push({title:'Orçamento ou resposta disponível',text:`${item.id} está como “${item.status}”.`,date:item.adminResponse.sentAt,href:`detalhes-solicitacao.html?id=${encodeURIComponent(item.id)}`,icon:icons.check});
    });
    notifications.sort((a,b)=>new Date(b.date)-new Date(a.date));
    installNotifications(clientPage.querySelector('.dashboard-welcome'),notifications.slice(0,8),'Área do cliente');
    addStatIcons(clientPage.querySelector('.dashboard-stats'),[icons.file,icons.message,icons.progress]);
    insertDashboardDetails(clientPage.querySelector('.dashboard-content'),items,false);
  }

  if (adminPage) {
    const notifications=[];
    requests.forEach(item=>{
      (Array.isArray(item.messages)?item.messages:[]).filter(m=>m.sender==='client'&&!m.readByAdmin).forEach(m=>notifications.push({title:`Nova mensagem de ${item.ownerName || 'cliente'}`,text:`${item.id} · ${m.text.slice(0,75)}`,date:m.sentAt,href:`admin-solicitacao.html?id=${encodeURIComponent(item.id)}&mensagem=${encodeURIComponent(m.id)}`,icon:icons.message}));
      (Array.isArray(item.attachments)?item.attachments:[]).filter(file=>file.sender==='client'&&!file.readByAdmin).forEach(file=>notifications.push({title:`Novo arquivo de ${item.ownerName || 'cliente'}`,text:`${item.id} · ${file.name}`,date:file.sentAt,href:`admin-solicitacao.html?id=${encodeURIComponent(item.id)}&arquivo=${encodeURIComponent(file.id)}#files`,icon:icons.attachment}));
      if(item.status==='Enviada') notifications.push({title:'Nova solicitação recebida',text:`${item.id} · ${item.title}`,date:item.createdAt,href:`admin-solicitacao.html?id=${encodeURIComponent(item.id)}`,icon:icons.file});
    });
    notifications.sort((a,b)=>new Date(b.date)-new Date(a.date));
    installNotifications(adminPage.querySelector('.dashboard-welcome'),notifications.slice(0,10),'Administrador');
    addStatIcons(adminPage.querySelector('.dashboard-stats'),[icons.file,icons.bell,icons.progress,icons.check]);
    insertDashboardDetails(adminPage.querySelector('.dashboard-content'),requests,true);
  }

  const initialSnapshot = localStorage.getItem(requestKey) || '[]';
  const refreshIfChanged = () => {
    if ((localStorage.getItem(requestKey) || '[]') !== initialSnapshot) location.reload();
  };
  window.addEventListener('focus', refreshIfChanged);
  window.addEventListener('storage', event => { if (event.key === requestKey) refreshIfChanged(); });
})();
