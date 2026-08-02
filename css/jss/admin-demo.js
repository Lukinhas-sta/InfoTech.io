(() => {
  const requestsKey = 'infotechDemoRequests';
  const adminKey = 'infotechDemoAdmin';
  const statuses = ['Enviada','Lida','Em análise','Orçamento enviado','Aguardando aprovação','Alteração solicitada','Aprovada','Em andamento','Concluída','Cancelada'];
  const readRequests = () => { try { return JSON.parse(localStorage.getItem(requestsKey)) || []; } catch { return []; } };
  const saveRequests = items => { try { localStorage.setItem(requestsKey, JSON.stringify(items)); } catch {} };
  const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const formatDate = iso => { try { return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso)); } catch { return 'Data não informada'; } };
  const isAdmin = () => { try { return sessionStorage.getItem(adminKey) === 'true'; } catch { return false; } };
  const setAdmin = value => { try { sessionStorage.setItem(adminKey, String(value)); } catch {} };
  const messageId = () => `MSG-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const installAdminReadTracking = (thread, item, items) => {
    if (!thread || !('IntersectionObserver' in window)) return;
    if (thread._readObserver) thread._readObserver.disconnect();
    const timers = new Map();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const id = entry.target.dataset.messageId;
        if (!id) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
          if (timers.has(id)) return;
          timers.set(id, setTimeout(() => {
            const message = item.messages.find(message => message.id === id);
            if (message && message.sender === 'client' && !message.readByAdmin) {
              message.readByAdmin = true;
              entry.target.dataset.unread = 'false';
              entry.target.classList.add('message-seen');
              saveRequests(items);
              window.dispatchEvent(new CustomEvent('infotech:message-read', { detail: { messageId: id, viewer: 'admin' } }));
            }
            timers.delete(id);
            observer.unobserve(entry.target);
          }, 450));
        } else if (timers.has(id)) {
          clearTimeout(timers.get(id));
          timers.delete(id);
        }
      });
    }, { root: thread, threshold: [0.7] });
    thread.querySelectorAll('.chat-message[data-unread="true"]').forEach(message => observer.observe(message));
    thread._readObserver = observer;

    const targetId = new URLSearchParams(location.search).get('mensagem');
    if (targetId) {
      const target = thread.querySelector(`[data-message-id="${CSS.escape(targetId)}"]`);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.classList.add('message-highlight');
      setTimeout(() => target?.classList.remove('message-highlight'), 1800);
    }
  };
  const renderChat = (thread, messages) => {
    if (!thread) return;
    if (!messages.length) {
      thread.innerHTML = '<div class="chat-empty"><strong>Nenhuma mensagem ainda</strong><p>Envie uma mensagem ou aguarde uma dúvida do cliente.</p></div>';
      return;
    }
    thread.innerHTML = messages.map(message => {
      const senderIsClient = message.sender === 'client';
      const label = senderIsClient ? (message.senderName || 'Cliente') : 'Infotech';
      return `<article class="chat-message ${senderIsClient?'chat-message-client':'chat-message-admin'}" data-message-id="${escapeHtml(message.id || '')}" data-unread="${message.sender === 'client' && !message.readByAdmin}"><div class="chat-message-meta"><strong>${escapeHtml(label)}</strong><span>${formatDate(message.sentAt)}</span></div><p>${escapeHtml(message.text)}</p></article>`;
    }).join('');
    requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; });
  };

  const login = document.getElementById('demo-admin-login');
  if (login) login.addEventListener('submit', event => {
    event.preventDefault();
    const message = document.getElementById('admin-login-message');
    const code = login.elements.code.value.trim();
    if (code !== 'admin123') {
      message.textContent = 'Código incorreto. Use admin123 nesta demonstração.';
      message.className = 'form-message error';
      return;
    }
    setAdmin(true);
    message.textContent = 'Acesso liberado. Abrindo o painel...';
    message.className = 'form-message success';
    setTimeout(() => location.href = 'painel-admin.html', 350);
  });

  document.querySelectorAll('[data-admin-logout]').forEach(el => el.addEventListener('click', () => { try { sessionStorage.removeItem(adminKey); } catch {} }));
  if ((document.body.querySelector('.admin-dashboard') || document.getElementById('admin-request-detail')) && !isAdmin()) location.href = 'admin-login.html';

  const statusClass = status => {
    if (status === 'Concluída') return 'status-done';
    if (status === 'Cancelada') return 'status-cancelled';
    if (['Em andamento','Aprovada'].includes(status)) return 'status-progress';
    if (['Em análise','Lida','Orçamento enviado','Aguardando aprovação','Alteração solicitada'].includes(status)) return 'status-analysis';
    return 'status-sent';
  };

  const renderStats = items => {
    const set = (selector, value) => document.querySelectorAll(selector).forEach(el => el.textContent = String(value));
    set('[data-admin-total]', items.length);
    set('[data-admin-new]', items.filter(i => ['Enviada','Lida','Em análise'].includes(i.status)).length);
    set('[data-admin-progress]', items.filter(i => ['Aprovada','Em andamento'].includes(i.status)).length);
    set('[data-admin-done]', items.filter(i => i.status === 'Concluída').length);
  };

  const list = document.getElementById('admin-requests-list');
  const filter = document.getElementById('admin-status-filter');
  if (list) {
    const render = () => {
      const items = readRequests();
      renderStats(items);
      const selected = filter?.value || 'todos';
      const visible = selected === 'todos' ? items : items.filter(item => item.status === selected);
      if (!visible.length) {
        list.innerHTML = '<div class="empty-state"><h3>Nenhuma solicitação encontrada</h3><p>Crie uma solicitação pela área do cliente ou escolha outro filtro.</p></div>';
        return;
      }
      list.innerHTML = visible.map(item => `<article class="request-card admin-request-card"><div class="request-main"><div class="admin-request-top"><span class="request-id">#${escapeHtml(item.id)}</span><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.service)} — ${escapeHtml(item.description.slice(0,150))}${item.description.length>150?'…':''}</p>${item.proposalDecision?.type && !item.proposalDecision.readByAdmin ? '<div class="request-unread proposal-unread">Nova decisão sobre o orçamento</div>' : ''}${Array.isArray(item.messages) && item.messages.some(message => message.sender === 'client' && !message.readByAdmin) ? '<div class="request-unread">Nova mensagem do cliente</div>' : ''}<div class="request-owner">Cliente: ${escapeHtml(item.ownerName || 'Não identificado')} · ${escapeHtml(item.ownerEmail || 'e-mail antigo')}</div><div class="request-meta"><span>Criada em ${formatDate(item.createdAt)}</span><span>Atualizada em ${formatDate(item.updatedAt || item.createdAt)}</span></div></div><a class="btn btn-outline" href="admin-solicitacao.html?id=${encodeURIComponent(item.id)}">Gerenciar</a></article>`).join('');
    };
    filter?.addEventListener('change', render);
    render();
  }

  const detail = document.getElementById('admin-request-detail');
  if (detail) {
    const id = new URLSearchParams(location.search).get('id');
    const items = readRequests();
    const item = items.find(request => request.id === id);
    if (!item) {
      detail.innerHTML = '<div class="empty-state"><h1>Solicitação não encontrada</h1><p>Volte ao painel e escolha uma solicitação existente.</p><a class="btn btn-outline" href="painel-admin.html">Voltar ao painel</a></div>';
    } else {
      const set = (selector, value) => { const el = detail.querySelector(selector); if (el) el.textContent = value || 'Não informado'; };
      set('[data-admin-id]', '#' + item.id); set('[data-admin-title]', item.title); set('[data-admin-service]', item.service); set('[data-admin-description]', item.description); set('[data-admin-deadline]', item.deadline); set('[data-admin-budget]', item.budget); set('[data-admin-contact]', item.contact); set('[data-admin-date]', formatDate(item.createdAt));
      const reference = detail.querySelector('[data-admin-reference]');
      if (item.reference) reference.innerHTML = `<a href="${escapeHtml(item.reference)}" target="_blank" rel="noopener noreferrer">Abrir referência</a>`; else reference.textContent = 'Não informada';
      const badge = detail.querySelector('[data-admin-status-badge]');
      const select = document.getElementById('admin-request-status');
      const viability = document.getElementById('admin-request-viability');
      const response = document.getElementById('admin-response-text');
      const value = document.getElementById('admin-response-value');
      const estimatedDeadline = document.getElementById('admin-response-deadline');
      const notes = document.getElementById('admin-response-notes');
      badge.textContent = item.status; badge.className = `status ${statusClass(item.status)}`;
      select.value = statuses.includes(item.status) ? item.status : 'Enviada';
      viability.value = item.adminResponse?.viability || '';
      response.value = item.adminResponse?.response || '';
      value.value = item.adminResponse?.value || '';
      estimatedDeadline.value = item.adminResponse?.estimatedDeadline || '';
      notes.value = item.adminResponse?.notes || '';
      const adminDecision = document.getElementById('admin-client-decision');
      if (adminDecision) {
        const decision = item.proposalDecision;
        if (!decision?.type) {
          adminDecision.innerHTML = '<div class="admin-decision-pending"><strong>Aguardando decisão do cliente</strong><p>Quando o cliente aceitar, recusar ou pedir alteração, a resposta aparecerá aqui.</p></div>';
        } else {
          const labels = {
            accepted: ['Orçamento aceito', 'O cliente aprovou a proposta.', 'proposal-accepted'],
            rejected: ['Orçamento recusado', 'O cliente decidiu não continuar com a proposta.', 'proposal-rejected'],
            change_requested: ['Alteração solicitada', 'O cliente pediu uma revisão da proposta.', 'proposal-change']
          };
          const [title, text, cssClass] = labels[decision.type] || labels.change_requested;
          adminDecision.innerHTML = `<div class="admin-decision-result ${cssClass}"><strong>${title}</strong><p>${text}</p>${decision.note ? `<div class="proposal-note"><span>Pedido do cliente</span><p>${escapeHtml(decision.note)}</p></div>` : ''}<small>Registrado em ${formatDate(decision.decidedAt)}</small></div>`;
          if (!decision.readByAdmin) { decision.readByAdmin = true; saveRequests(items); }
        }
      }
      const decisionActions = document.getElementById('admin-decision-actions');
      if (decisionActions) {
        if (item.proposalDecision?.type === 'accepted' && item.status === 'Aprovada') {
          decisionActions.innerHTML = `<div class="accepted-next-step"><div><strong>Orçamento aprovado pelo cliente</strong><p>Quando estiver pronto para começar, altere a solicitação para Em andamento.</p></div><button class="btn auth-primary" id="start-approved-project" type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>Iniciar projeto</button></div>`;
          document.getElementById('start-approved-project')?.addEventListener('click', () => {
            item.status = 'Em andamento';
            item.updatedAt = new Date().toISOString();
            saveRequests(items);
            badge.textContent = item.status;
            badge.className = `status ${statusClass(item.status)}`;
            select.value = item.status;
            decisionActions.innerHTML = '<div class="accepted-next-step started"><strong>Projeto iniciado</strong><p>O cliente já verá o status Em andamento.</p></div>';
          });
        } else if (item.proposalDecision?.type === 'accepted' && item.status === 'Em andamento') {
          decisionActions.innerHTML = '<div class="accepted-next-step started"><strong>Projeto iniciado</strong><p>O cliente está acompanhando o status Em andamento.</p></div>';
        } else {
          decisionActions.innerHTML = '';
        }
      }
      item.messages = Array.isArray(item.messages) ? item.messages : [];
      const adminThread = document.getElementById('admin-chat-thread');
      const adminCount = detail.querySelector('[data-admin-message-count]');
      const updateAdminChat = () => {
        renderChat(adminThread, item.messages);
        installAdminReadTracking(adminThread, item, items);
        if (adminCount) adminCount.textContent = `${item.messages.length} ${item.messages.length === 1 ? 'mensagem' : 'mensagens'}`;
      };
      updateAdminChat();
      document.getElementById('admin-chat-form')?.addEventListener('submit', event => {
        event.preventDefault();
        const input = document.getElementById('admin-chat-message');
        const feedback = document.getElementById('admin-chat-feedback');
        const text = input.value.trim();
        if (!text) {
          feedback.textContent = 'Escreva uma mensagem antes de enviar.';
          feedback.className = 'form-message error';
          return;
        }
        item.messages.push({ id: messageId(), sender:'admin', senderName:'Infotech', text, sentAt:new Date().toISOString(), readByClient:false, readByAdmin:true });
        item.updatedAt = new Date().toISOString();
        saveRequests(items);
        input.value = '';
        feedback.textContent = 'Mensagem enviada ao cliente.';
        feedback.className = 'form-message success';
        updateAdminChat();
      });

      document.getElementById('admin-response-form').addEventListener('submit', event => {
        event.preventDefault();
        const hasResponse = response.value.trim() || value.value.trim() || estimatedDeadline.value.trim() || notes.value.trim() || viability.value;
        if (!hasResponse && select.value === item.status) {
          const message = document.getElementById('admin-response-message');
          message.textContent = 'Preencha uma resposta ou altere o status antes de salvar.';
          message.className = 'form-message error';
          return;
        }
        item.status = select.value;
        if (['Orçamento enviado','Aguardando aprovação'].includes(select.value)) item.proposalDecision = null;
        item.adminResponse = {
          viability: viability.value,
          response: response.value.trim(),
          value: value.value.trim(),
          estimatedDeadline: estimatedDeadline.value.trim(),
          notes: notes.value.trim(),
          sentAt: new Date().toISOString(),
          readByClient: false
        };
        item.updatedAt = item.adminResponse.sentAt;
        saveRequests(items);
        badge.textContent = item.status; badge.className = `status ${statusClass(item.status)}`;
        const message = document.getElementById('admin-response-message');
        message.textContent = 'Resposta e orçamento salvos. O cliente já pode visualizar.';
        message.className = 'form-message success';
      });
    }
  }

  // Atualiza o painel quando o cliente toma uma decisão em outra aba ou janela.
  let lastRequestsSnapshot = localStorage.getItem(requestsKey) || '';
  const refreshIfRequestsChanged = () => {
    const currentSnapshot = localStorage.getItem(requestsKey) || '';
    if (currentSnapshot !== lastRequestsSnapshot) location.reload();
  };
  window.addEventListener('storage', event => {
    if (event.key === requestsKey) location.reload();
  });
  window.addEventListener('focus', refreshIfRequestsChanged);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshIfRequestsChanged();
  });
})();
