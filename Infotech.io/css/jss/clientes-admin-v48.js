(() => {
  const ACCOUNTS_KEY = 'infotechDemoAccounts';
  const REQUESTS_KEY = 'infotechDemoRequests';
  const ADMIN_KEY = 'infotechDemoAdmin';
  const normalize = value => String(value || '').trim().toLowerCase();
  const safeJson = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } };
  const readAccounts = () => { const value = safeJson(ACCOUNTS_KEY, []); return Array.isArray(value) ? value : []; };
  const readRequests = () => { const value = safeJson(REQUESTS_KEY, []); return Array.isArray(value) ? value : []; };
  const saveAccounts = accounts => { try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); } catch {} };
  const isBlocked = account => account?.status === 'blocked';
  const accountStatusLabel = account => isBlocked(account) ? 'Bloqueado' : 'Ativo';
  const appendSecurityLog = (account, type, detail) => {
    const log = Array.isArray(account.securityLog) ? account.securityLog : [];
    log.unshift({ type, detail, at: new Date().toISOString() });
    account.securityLog = log.slice(0, 20);
  };
  const isAdmin = () => { try { return sessionStorage.getItem(ADMIN_KEY) === 'true'; } catch { return false; } };
  const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const formatDate = value => { if (!value) return 'Não informado'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'Não informado'; return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(date); };
  const initials = name => String(name || 'Cliente').trim().split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase() || 'CL';
  const statusClass = status => {
    if (status === 'Concluída') return 'status-done';
    if (status === 'Cancelada') return 'status-cancelled';
    if (['Em andamento','Aprovada'].includes(status)) return 'status-progress';
    if (['Em análise','Lida','Orçamento enviado','Aguardando aprovação','Alteração solicitada'].includes(status)) return 'status-analysis';
    return 'status-sent';
  };
  const accountRequests = (account, requests) => requests.filter(request => normalize(request.ownerEmail) === normalize(account.email));
  const companyFor = items => items.map(item => item.company || item.companyName || item.business || item.organization).find(Boolean) || 'Não informada';
  const lastActivity = (account, items) => {
    const dates = [account.lastActivityAt, account.lastLoginAt, account.updatedAt, account.createdAt, ...items.map(item => item.updatedAt || item.createdAt)].filter(Boolean).map(value => new Date(value)).filter(date => !Number.isNaN(date.getTime()));
    return dates.length ? new Date(Math.max(...dates.map(date => date.getTime()))).toISOString() : null;
  };
  if (!isAdmin()) { location.href = 'admin-login.html'; return; }

  const list = document.getElementById('admin-clients-list');
  if (list) {
    const search = document.getElementById('admin-client-search');
    const accounts = readAccounts();
    const requests = readRequests();
    const render = () => {
      const query = normalize(search?.value);
      const rows = accounts.map(account => {
        const items = accountRequests(account, requests);
        return { account, items, company: companyFor(items), activity: lastActivity(account, items) };
      }).filter(row => [row.account.name,row.account.email,row.company].some(value => normalize(value).includes(query)));
      document.querySelectorAll('[data-client-total]').forEach(el => el.textContent = String(accounts.length));
      document.querySelectorAll('[data-client-with-requests]').forEach(el => el.textContent = String(accounts.filter(account => accountRequests(account, requests).length).length));
      document.querySelectorAll('[data-client-active-projects]').forEach(el => el.textContent = String(requests.filter(item => ['Aprovada','Em andamento'].includes(item.status)).length));
      document.querySelectorAll('[data-client-total-requests]').forEach(el => el.textContent = String(requests.length));
      const count = document.querySelector('[data-client-results-count]');
      if (count) count.textContent = `${rows.length} ${rows.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}`;
      if (!rows.length) {
        list.innerHTML = '<div class="empty-state"><h3>Nenhum cliente encontrado</h3><p>Crie uma conta de demonstração ou tente outro nome ou e-mail.</p></div>';
        return;
      }
      list.innerHTML = rows.sort((a,b) => new Date(b.activity || 0) - new Date(a.activity || 0)).map(({account,items,company,activity}) => `
        <article class="client-card">
          <div class="client-avatar" aria-hidden="true">${escapeHtml(initials(account.name))}</div>
          <div class="client-main">
            <h3>${escapeHtml(account.name || 'Cliente')}</h3>
            <p>${escapeHtml(account.email || 'E-mail não informado')}</p>
            <div class="client-meta"><span>${items.length} ${items.length === 1 ? 'solicitação' : 'solicitações'}</span><span>Empresa: ${escapeHtml(company)}</span><span>Cadastro: ${formatDate(account.createdAt)}</span></div>
          </div>
          <div class="client-actions"><span class="client-status ${isBlocked(account) ? 'is-blocked' : ''}">${accountStatusLabel(account)}</span><button class="btn ${isBlocked(account) ? 'btn-outline' : 'btn-danger'} client-access-toggle" type="button" data-account-toggle="${escapeHtml(account.id || account.email)}">${isBlocked(account) ? 'Reativar' : 'Bloquear'}</button><a class="btn btn-outline" href="cliente-admin.html?id=${encodeURIComponent(account.id || account.email)}">Ver perfil</a></div>
        </article>`).join('');
    };
    search?.addEventListener('input', render);
    list.addEventListener('click', event => {
      const button = event.target.closest('[data-account-toggle]');
      if (!button) return;
      const key = button.dataset.accountToggle;
      const allAccounts = readAccounts();
      const index = allAccounts.findIndex(account => String(account.id) === String(key) || normalize(account.email) === normalize(key));
      if (index < 0) return;
      const blocking = !isBlocked(allAccounts[index]);
      const confirmed = window.confirm(blocking
        ? `Bloquear a conta de ${allAccounts[index].name || allAccounts[index].email}? Ela não poderá entrar enquanto estiver bloqueada.`
        : `Reativar a conta de ${allAccounts[index].name || allAccounts[index].email}?`);
      if (!confirmed) return;
      allAccounts[index].status = blocking ? 'blocked' : 'active';
      allAccounts[index].statusUpdatedAt = new Date().toISOString();
      allAccounts[index].sessionVersion = Number(allAccounts[index].sessionVersion || 1) + 1;
      appendSecurityLog(allAccounts[index], blocking ? 'blocked' : 'reactivated', blocking ? 'Conta bloqueada pelo administrador.' : 'Conta reativada pelo administrador.');
      saveAccounts(allAccounts);
      const current = safeJson('infotechDemoUser', {});
      if (blocking && normalize(current.email) === normalize(allAccounts[index].email)) {
        try { localStorage.removeItem('infotechDemoUser'); } catch {}
      }
      render();
    });
    window.addEventListener('storage', event => { if ([ACCOUNTS_KEY,REQUESTS_KEY].includes(event.key)) render(); });
    render();
  }

  const detail = document.getElementById('admin-client-detail');
  if (detail) {
    const key = new URLSearchParams(location.search).get('id');
    const accounts = readAccounts();
    const requests = readRequests();
    const account = accounts.find(item => String(item.id) === String(key) || normalize(item.email) === normalize(key));
    if (!account) {
      detail.innerHTML = '<div class="empty-state"><h1>Cliente não encontrado</h1><p>Volte para a lista e escolha uma conta existente.</p><a class="btn btn-outline" href="clientes-admin.html">Voltar para clientes</a></div>';
      return;
    }
    const items = accountRequests(account, requests);
    const company = companyFor(items);
    const attachments = items.reduce((total,item) => total + (Array.isArray(item.attachments) ? item.attachments.length : 0),0);
    const messages = items.reduce((total,item) => total + (Array.isArray(item.messages) ? item.messages.length : 0),0);
    document.querySelectorAll('[data-client-name]').forEach(el => el.textContent = account.name || 'Cliente');
    document.querySelectorAll('[data-client-email]').forEach(el => el.textContent = account.email || 'Não informado');
    document.querySelectorAll('[data-client-company]').forEach(el => el.textContent = company);
    document.querySelectorAll('[data-client-created]').forEach(el => el.textContent = formatDate(account.createdAt));
    document.querySelectorAll('[data-client-last-activity]').forEach(el => el.textContent = formatDate(lastActivity(account,items)));
    document.querySelectorAll('[data-client-last-login]').forEach(el => el.textContent = formatDate(account.lastLoginAt));
    document.querySelectorAll('[data-client-password-changed]').forEach(el => el.textContent = account.passwordChangedAt ? formatDate(account.passwordChangedAt) : 'Nunca');
    document.querySelectorAll('[data-client-session-ended]').forEach(el => el.textContent = account.sessionEndedAt ? formatDate(account.sessionEndedAt) : 'Nunca');
    const recoveryLink = document.querySelector('[data-client-recovery-link]');
    if (recoveryLink) recoveryLink.href = `recuperar-senha.html?email=${encodeURIComponent(account.email || '')}`;
    const securityLog = document.querySelector('[data-client-security-log]');
    if (securityLog) {
      const entries = Array.isArray(account.securityLog) ? account.securityLog : [];
      securityLog.innerHTML = entries.length ? entries.map(entry => `<article class="security-log-item"><strong>${escapeHtml(entry.detail || 'Atividade de segurança')}</strong><span>${formatDate(entry.at)}</span></article>`).join('') : '<div class="empty-state"><p>Nenhuma atividade de segurança registrada.</p></div>';
    }
    document.querySelectorAll('[data-client-request-count]').forEach(el => el.textContent = String(items.length));
    document.querySelectorAll('[data-client-project-count]').forEach(el => el.textContent = String(items.filter(item => ['Aprovada','Em andamento','Concluída'].includes(item.status)).length));
    document.querySelectorAll('[data-client-file-count]').forEach(el => el.textContent = String(attachments));
    document.querySelectorAll('[data-client-message-count]').forEach(el => el.textContent = String(messages));
    const avatar = document.querySelector('[data-client-avatar]'); if (avatar) avatar.textContent = initials(account.name);
    const applyAccessState = currentAccount => {
      document.querySelectorAll('[data-client-account-status]').forEach(el => {
        el.textContent = accountStatusLabel(currentAccount);
        el.classList.toggle('is-blocked', isBlocked(currentAccount));
      });
      document.querySelectorAll('[data-client-account-status-text]').forEach(el => { el.textContent = isBlocked(currentAccount) ? 'Bloqueada' : 'Ativa'; });
      document.querySelectorAll('[data-client-access-description]').forEach(el => {
        el.textContent = isBlocked(currentAccount)
          ? 'A conta está impedida de entrar na Área do Cliente até ser reativada.'
          : 'A conta está liberada para entrar na Área do Cliente.';
      });
      const toggleButton = document.querySelector('[data-toggle-client-access]');
      if (toggleButton) {
        toggleButton.textContent = isBlocked(currentAccount) ? 'Reativar conta' : 'Bloquear conta';
        toggleButton.classList.toggle('btn-danger', !isBlocked(currentAccount));
        toggleButton.classList.toggle('btn-outline', isBlocked(currentAccount));
      }
    };
    applyAccessState(account);
    const accessButton = document.querySelector('[data-toggle-client-access]');
    accessButton?.addEventListener('click', () => {
      const allAccounts = readAccounts();
      const index = allAccounts.findIndex(item => String(item.id) === String(account.id) || normalize(item.email) === normalize(account.email));
      if (index < 0) return;
      const blocking = !isBlocked(allAccounts[index]);
      const confirmed = window.confirm(blocking
        ? `Bloquear a conta de ${allAccounts[index].name || allAccounts[index].email}? Ela não poderá entrar enquanto estiver bloqueada.`
        : `Reativar a conta de ${allAccounts[index].name || allAccounts[index].email}?`);
      if (!confirmed) return;
      allAccounts[index].status = blocking ? 'blocked' : 'active';
      allAccounts[index].statusUpdatedAt = new Date().toISOString();
      allAccounts[index].sessionVersion = Number(allAccounts[index].sessionVersion || 1) + 1;
      appendSecurityLog(allAccounts[index], blocking ? 'blocked' : 'reactivated', blocking ? 'Conta bloqueada pelo administrador.' : 'Conta reativada pelo administrador.');
      saveAccounts(allAccounts);
      Object.assign(account, allAccounts[index]);
      const current = safeJson('infotechDemoUser', {});
      if (blocking && normalize(current.email) === normalize(account.email)) {
        try { localStorage.removeItem('infotechDemoUser'); } catch {}
      }
      applyAccessState(account);
    });
    const endSessionsButton = document.querySelector('[data-end-client-sessions]');
    endSessionsButton?.addEventListener('click', () => {
      if (!window.confirm(`Encerrar todas as sessões de ${account.name || account.email}?`)) return;
      const allAccounts = readAccounts();
      const index = allAccounts.findIndex(item => String(item.id) === String(account.id) || normalize(item.email) === normalize(account.email));
      if (index < 0) return;
      allAccounts[index].sessionVersion = Number(allAccounts[index].sessionVersion || 1) + 1;
      allAccounts[index].sessionEndedAt = new Date().toISOString();
      allAccounts[index].updatedAt = new Date().toISOString();
      appendSecurityLog(allAccounts[index], 'sessions_ended', 'Todas as sessões foram encerradas pelo administrador.');
      saveAccounts(allAccounts);
      Object.assign(account, allAccounts[index]);
      const current = safeJson('infotechDemoUser', {});
      if (normalize(current.email) === normalize(account.email)) {
        try { localStorage.removeItem('infotechDemoUser'); } catch {}
      }
      document.querySelectorAll('[data-client-session-ended]').forEach(el => el.textContent = formatDate(account.sessionEndedAt));
      const securityLog = document.querySelector('[data-client-security-log]');
      if (securityLog) securityLog.innerHTML = account.securityLog.map(entry => `<article class="security-log-item"><strong>${escapeHtml(entry.detail || 'Atividade de segurança')}</strong><span>${formatDate(entry.at)}</span></article>`).join('');
      window.alert('Sessões encerradas com sucesso.');
    });
    const requestList = document.getElementById('admin-client-requests');
    if (!items.length) requestList.innerHTML = '<div class="empty-state"><h3>Nenhuma solicitação</h3><p>Esta conta ainda não criou solicitações neste navegador.</p></div>';
    else requestList.innerHTML = items.sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0)).map(item => `
      <article class="client-request-item"><div><div class="admin-request-top"><span class="request-id">#${escapeHtml(item.id || 'SEM-PROTOCOLO')}</span><span class="status ${statusClass(item.status)}">${escapeHtml(item.status || 'Enviada')}</span></div><h3>${escapeHtml(item.title || item.service || 'Solicitação')}</h3><p>${escapeHtml(item.service || 'Serviço não informado')} · Atualizada em ${formatDate(item.updatedAt || item.createdAt)}</p></div><a class="btn btn-outline" href="admin-solicitacao.html?id=${encodeURIComponent(item.id || '')}">Gerenciar</a></article>`).join('');
  }
})();
