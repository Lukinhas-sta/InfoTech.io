/* Infotech.io — Dashboard Administrativo Inteligente | 4.7.1, refinado na 4.7.2 */
(() => {
  'use strict';

  const REQUESTS_KEY = 'infotechDemoRequests';
  const ACCOUNTS_KEY = 'infotechDemoAccounts';
  const list = document.getElementById('admin-requests-list');
  const search = document.getElementById('admin-request-search');
  const ANALYSIS_STATUSES = ['Enviada', 'Lida', 'Em análise', 'Orçamento enviado', 'Aguardando aprovação', 'Alteração solicitada'];
  const PROGRESS_STATUSES = ['Aprovada', 'Em andamento'];

  if (!list || !search) return;

  const filters = {
    all: { title: 'Todas as solicitações', matches: () => true },
    analysis: { title: 'Solicitações em análise', matches: item => ANALYSIS_STATUSES.includes(item.status) },
    progress: { title: 'Solicitações em andamento', matches: item => PROGRESS_STATUSES.includes(item.status) },
    done: { title: 'Solicitações concluídas', matches: item => item.status === 'Concluída' },
    cancelled: { title: 'Solicitações canceladas', matches: item => item.status === 'Cancelada' },
    priority: { title: 'Solicitações com prioridade alta', matches: item => isHighPriority(item) }
  };

  let activeFilter = 'all';

  const readJson = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const readRequests = () => {
    const items = readJson(REQUESTS_KEY, []);
    return Array.isArray(items) ? items : [];
  };

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  const formatDate = iso => {
    try {
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
    } catch {
      return 'Data não informada';
    }
  };

  const statusClass = status => {
    if (status === 'Concluída') return 'status-done';
    if (status === 'Cancelada') return 'status-cancelled';
    if (['Em andamento', 'Aprovada'].includes(status)) return 'status-progress';
    if (['Em análise', 'Lida', 'Orçamento enviado', 'Aguardando aprovação', 'Alteração solicitada'].includes(status)) return 'status-analysis';
    return 'status-sent';
  };

  function isHighPriority(item) {
    if (['Concluída', 'Cancelada'].includes(item.status)) return false;

    const declaredPriority = normalize(item.priority || item.prioridade || item.priorityLevel);
    if (['alta', 'high', 'urgente', 'critica', 'critico'].includes(declaredPriority)) return true;

    const desiredDeadline = normalize(item.deadline || item.prazo);
    if (desiredDeadline.includes('ate 7 dias') || desiredDeadline.includes('urgente')) return true;

    const dueDate = item.dueDate || item.deadlineAt;
    if (!dueDate) return false;
    const remainingDays = (new Date(dueDate).getTime() - Date.now()) / 86400000;
    return Number.isFinite(remainingDays) && remainingDays >= 0 && remainingDays <= 7;
  }

  const companiesByEmail = () => {
    const accounts = readJson(ACCOUNTS_KEY, []);
    if (!Array.isArray(accounts)) return new Map();
    return new Map(accounts.map(account => [normalize(account.email), account.company || account.companyName || account.empresa || '']));
  };

  const companyOf = (item, companyMap) => item.company || item.companyName || item.ownerCompany || item.empresa || companyMap.get(normalize(item.ownerEmail)) || '';

  const matchesSearch = (item, query, companyMap) => {
    if (!query) return true;
    const searchable = [item.ownerName, item.id, item.protocol, item.service, companyOf(item, companyMap)]
      .map(normalize)
      .join(' ');
    return searchable.includes(query);
  };

  const setText = (selector, value) => {
    document.querySelectorAll(selector).forEach(element => { element.textContent = String(value); });
  };

  const updateStats = items => {
    setText('[data-admin-total]', items.length);
    setText('[data-admin-new]', items.filter(filters.analysis.matches).length);
    setText('[data-admin-progress]', items.filter(filters.progress.matches).length);
    setText('[data-admin-done]', items.filter(filters.done.matches).length);
    setText('[data-admin-priority]', items.filter(filters.priority.matches).length);
  };

  const updateActiveControls = () => {
    document.querySelectorAll('[data-dashboard-filter], [data-status-filter]').forEach(control => {
      const value = control.dataset.dashboardFilter || control.dataset.statusFilter;
      const active = value === activeFilter;
      control.classList.toggle('is-active', active);
      control.setAttribute('aria-pressed', String(active));
    });
  };

  const renderCard = (item, companyMap) => {
    const description = String(item.description || '');
    const company = companyOf(item, companyMap);
    const priority = isHighPriority(item);
    const unreadDecision = item.proposalDecision?.type && !item.proposalDecision.readByAdmin;
    const unreadMessage = Array.isArray(item.messages) && item.messages.some(message => message.sender === 'client' && !message.readByAdmin);

    return `<article class="request-card admin-request-card">
      <div class="request-main">
        <div class="admin-request-top"><span class="request-id">#${escapeHtml(item.id || 'SEM-PROTOCOLO')}</span><span class="status ${statusClass(item.status)}">${escapeHtml(item.status || 'Enviada')}</span></div>
        <h3>${escapeHtml(item.title || item.service || 'Solicitação sem título')}</h3>
        <p>${escapeHtml(item.service || 'Serviço não informado')} — ${escapeHtml(description.slice(0, 150))}${description.length > 150 ? '…' : ''}</p>
        ${unreadDecision ? '<div class="request-unread proposal-unread">Nova decisão sobre o orçamento</div>' : ''}
        ${unreadMessage ? '<div class="request-unread">Nova mensagem do cliente</div>' : ''}
        ${priority ? '<span class="admin-priority-badge">Prioridade alta</span>' : ''}
        <div class="request-owner">Cliente: ${escapeHtml(item.ownerName || 'Não identificado')} · ${escapeHtml(item.ownerEmail || 'e-mail antigo')}</div>
        ${company ? `<div class="admin-request-company">Empresa: ${escapeHtml(company)}</div>` : ''}
        <div class="request-meta"><span>Criada em ${formatDate(item.createdAt)}</span><span>Atualizada em ${formatDate(item.updatedAt || item.createdAt)}</span></div>
      </div>
      <a class="btn btn-outline" href="admin-solicitacao.html?id=${encodeURIComponent(item.id || '')}">Gerenciar</a>
    </article>`;
  };

  const render = () => {
    const items = readRequests();
    const query = normalize(search.value);
    const companyMap = companiesByEmail();
    const filter = filters[activeFilter] || filters.all;
    const visibleItems = items.filter(item => filter.matches(item) && matchesSearch(item, query, companyMap));

    updateStats(items);
    updateActiveControls();
    setText('[data-admin-list-title]', filter.title);
    setText('[data-admin-results-count]', `${visibleItems.length} ${visibleItems.length === 1 ? 'solicitação encontrada' : 'solicitações encontradas'}`);

    list.setAttribute('aria-busy', 'true');
    if (!visibleItems.length) {
      const hasSearch = Boolean(query);
      list.innerHTML = `<div class="empty-state admin-empty-state"><h3>Nenhuma solicitação encontrada</h3><p>${hasSearch ? 'Tente pesquisar por outro cliente, protocolo, serviço ou empresa.' : 'Não há solicitações neste filtro. Escolha outra categoria para continuar.'}</p></div>`;
    } else {
      list.innerHTML = visibleItems.map(item => renderCard(item, companyMap)).join('');
    }
    list.setAttribute('aria-busy', 'false');
  };

  document.querySelectorAll('[data-dashboard-filter], [data-status-filter]').forEach(control => {
    control.addEventListener('click', () => {
      activeFilter = control.dataset.dashboardFilter || control.dataset.statusFilter || 'all';
      render();
    });
  });

  search.addEventListener('input', render);
  window.addEventListener('storage', event => {
    if ([REQUESTS_KEY, ACCOUNTS_KEY].includes(event.key)) render();
  });

  render();
})();
