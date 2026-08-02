(() => {
  const requestsKey = 'infotechDemoRequests';
  const lastKey = 'infotechLastProtocol';
  const userKey = 'infotechDemoUser';
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const readRequests = () => { const value = readJson(requestsKey, []); return Array.isArray(value) ? value : []; };
  const saveRequests = items => { try { localStorage.setItem(requestsKey, JSON.stringify(items)); } catch {} };
  const readUser = () => readJson(userKey, {});
  const normalizeEmail = value => String(value || '').trim().toLowerCase();
  const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const formatDate = iso => { try { return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso)); } catch { return 'Data não informada'; } };
  const makeProtocol = items => {
    const year = new Date().getFullYear();
    const max = items.reduce((highest, item) => {
      const match = String(item.id || '').match(/(\d+)$/);
      return Math.max(highest, match ? Number(match[1]) : 0);
    }, 0);
    return `INF-${year}-${String(max + 1).padStart(4,'0')}`;
  };
  const statusClass = status => status === 'Concluída' ? 'status-done' : status === 'Cancelada' ? 'status-cancelled' : ['Aprovada','Em andamento'].includes(status) ? 'status-progress' : ['Lida','Em análise','Orçamento enviado','Aguardando aprovação','Alteração solicitada'].includes(status) ? 'status-analysis' : 'status-sent';
  const messageId = () => `MSG-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const renderChat = (thread, messages, viewer) => {
    if (!thread) return;
    if (!messages.length) {
      thread.innerHTML = '<div class="chat-empty"><strong>Nenhuma mensagem ainda</strong><p>Envie a primeira mensagem para iniciar a conversa.</p></div>';
      return;
    }
    thread.innerHTML = messages.map(message => {
      const senderIsClient = message.sender === 'client';
      const own = message.sender === viewer;
      const label = senderIsClient ? (message.senderName || 'Cliente') : 'Infotech';
      return `<article class="chat-message ${senderIsClient?'chat-message-client':'chat-message-admin'}" data-own="${own}" data-message-id="${escapeHtml(message.id || '')}" data-unread="${message.sender === 'admin' && !message.readByClient}"><div class="chat-message-meta"><strong>${escapeHtml(label)}</strong><span>${formatDate(message.sentAt)}</span></div><p>${escapeHtml(message.text)}</p></article>`;
    }).join('');
    requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; });
  };
  const currentUser = readUser();
  const owns = request => normalizeEmail(request.ownerEmail) === normalizeEmail(currentUser.email);
  const installMessageReadTracking = (thread, item, allItems, viewer) => {
    if (!thread || !('IntersectionObserver' in window)) return;
    if (thread._readObserver) thread._readObserver.disconnect();
    const readField = viewer === 'client' ? 'readByClient' : 'readByAdmin';
    const incomingSender = viewer === 'client' ? 'admin' : 'client';
    const timers = new Map();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const messageId = entry.target.dataset.messageId;
        if (!messageId) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
          if (timers.has(messageId)) return;
          const timer = setTimeout(() => {
            const message = item.messages.find(entry => entry.id === messageId);
            if (message && message.sender === incomingSender && !message[readField]) {
              message[readField] = true;
              entry.target.dataset.unread = 'false';
              entry.target.classList.add('message-seen');
              saveRequests(allItems);
              window.dispatchEvent(new CustomEvent('infotech:message-read', { detail: { messageId, viewer } }));
            }
            timers.delete(messageId);
            observer.unobserve(entry.target);
          }, 450);
          timers.set(messageId, timer);
        } else if (timers.has(messageId)) {
          clearTimeout(timers.get(messageId));
          timers.delete(messageId);
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

  const migrateUnownedRequests = () => {
    if (!currentUser.email) return;
    const items = readRequests();
    let changed = false;
    items.forEach(item => {
      if (!item.ownerEmail) {
        item.ownerEmail = currentUser.email;
        item.ownerName = currentUser.name || 'Cliente';
        changed = true;
      }
    });
    if (changed) saveRequests(items);
  };
  migrateUnownedRequests();

  const params = new URLSearchParams(location.search);
  const service = params.get('servico');
  const serviceSelect = document.getElementById('request-service');
  if (serviceSelect && service) {
    [...serviceSelect.options].some(option => {
      if (option.value.toLowerCase() === service.toLowerCase()) {
        serviceSelect.value = option.value;
        return true;
      }
      return false;
    });
  }

  const form = document.getElementById('demo-request-form');
  if (form) form.addEventListener('submit', event => {
    event.preventDefault();
    const message = document.getElementById('request-message');
    if (!currentUser.email) {
      location.href = 'login.html?destino=nova-solicitacao.html';
      return;
    }
    if (!form.checkValidity()) {
      message.textContent = 'Confira os campos obrigatórios antes de enviar.';
      message.className = 'form-message error field-full';
      form.reportValidity();
      return;
    }
    const items = readRequests();
    const data = new FormData(form);
    const request = {
      id: makeProtocol(items),
      ownerEmail: currentUser.email,
      ownerName: currentUser.name || 'Cliente',
      title: data.get('title').trim(),
      service: data.get('service'),
      description: data.get('description').trim(),
      deadline: data.get('deadline'),
      budget: data.get('budget'),
      contact: data.get('contact'),
      reference: data.get('reference').trim(),
      status: 'Enviada',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    items.unshift(request);
    saveRequests(items);
    try { localStorage.setItem(lastKey, request.id); } catch {}
    message.textContent = 'Solicitação enviada. Abrindo a confirmação...';
    message.className = 'form-message success field-full';
    setTimeout(() => location.href = 'solicitacao-enviada.html', 400);
  });

  document.querySelectorAll('[data-last-protocol]').forEach(el => {
    try { el.textContent = '#' + (localStorage.getItem(lastKey) || 'INF-0000'); } catch {}
  });

  const list = document.getElementById('demo-requests-list');
  if (list) {
    const items = readRequests().filter(owns);
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><h3>Nenhuma solicitação nesta conta</h3><p>Use o botão “Nova solicitação” para iniciar seu primeiro atendimento.</p></div>';
    } else {
      list.innerHTML = items.map(item => `<article class="request-card"><div class="request-main"><span class="request-id">#${escapeHtml(item.id)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.service)} — ${escapeHtml(item.description.slice(0,140))}${item.description.length>140?'…':''}</p><div class="request-meta"><span>Enviada em ${formatDate(item.createdAt)}</span><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></div></div><a class="btn btn-outline" href="detalhes-solicitacao.html?id=${encodeURIComponent(item.id)}">Ver detalhes</a></article>`).join('');
    }
    document.querySelectorAll('[data-open-count]').forEach(el => { el.textContent = String(items.filter(item => !['Concluída','Cancelada'].includes(item.status)).length); });
    document.querySelectorAll('[data-response-count]').forEach(el => { el.textContent = String(items.filter(item => item.adminResponse?.sentAt || (Array.isArray(item.messages) && item.messages.some(message => message.sender === 'admin'))).length); });
    document.querySelectorAll('[data-progress-count]').forEach(el => { el.textContent = String(items.filter(item => ['Aprovada','Em andamento'].includes(item.status)).length); });
  }

  const detail = document.getElementById('demo-request-detail');
  if (detail) {
    const id = params.get('id');
    const allItems = readRequests();
    const item = allItems.find(request => request.id === id && owns(request));
    if (!item) {
      detail.innerHTML = '<div class="empty-state"><h1>Solicitação não encontrada</h1><p>Esta solicitação não pertence à conta atual ou não existe.</p><a class="btn btn-outline" href="painel-cliente.html">Voltar ao painel</a></div>';
      return;
    }
    detail.querySelector('[data-request-id]').textContent = '#' + item.id;
    detail.querySelector('[data-request-title]').textContent = item.title;
    detail.querySelector('[data-request-service]').textContent = item.service;
    detail.querySelector('[data-request-description]').textContent = item.description;
    detail.querySelector('[data-request-deadline]').textContent = item.deadline;
    detail.querySelector('[data-request-budget]').textContent = item.budget;
    detail.querySelector('[data-request-contact]').textContent = item.contact;
    detail.querySelector('[data-request-date]').textContent = formatDate(item.createdAt);
    const status = detail.querySelector('[data-request-status]');
    if (status) { status.textContent = item.status; status.className = `status ${statusClass(item.status)}`; }
    const ref = detail.querySelector('[data-request-reference]');
    if (item.reference) ref.innerHTML = `<a href="${escapeHtml(item.reference)}" target="_blank" rel="noopener noreferrer">Abrir referência</a>`;
    else ref.textContent = 'Não informada';

    const responseArea = document.getElementById('client-response-area');
    const admin = item.adminResponse;
    if (responseArea && admin && (admin.viability || admin.response || admin.value || admin.estimatedDeadline || admin.notes)) {
      if (!admin.readByClient) { admin.readByClient = true; saveRequests(allItems); }
      responseArea.innerHTML = `<div class="message-box"><strong>${escapeHtml(admin.viability || 'Atualização da Infotech')}</strong>${admin.response?`<p>${escapeHtml(admin.response)}</p>`:''}<div class="response-details">${admin.value?`<div class="response-detail budget-highlight"><span>Valor do orçamento</span><strong>${escapeHtml(admin.value)}</strong></div>`:''}${admin.estimatedDeadline?`<div class="response-detail"><span>Prazo estimado</span><strong>${escapeHtml(admin.estimatedDeadline)}</strong></div>`:''}${admin.notes?`<div class="response-detail"><span>Observações</span><p>${escapeHtml(admin.notes)}</p></div>`:''}</div>${admin.sentAt?`<div class="response-updated">Atualizado em ${formatDate(admin.sentAt)}</div>`:''}</div>`;
    }

    const proposalSection = document.getElementById('client-proposal-decision');
    const proposalContent = document.getElementById('proposal-decision-content');
    const hasProposal = Boolean(admin && (admin.value || admin.estimatedDeadline || admin.response));
    const renderProposalDecision = () => {
      if (!proposalSection || !proposalContent) return;
      if (!hasProposal) {
        proposalSection.hidden = true;
        return;
      }
      proposalSection.hidden = false;
      const decision = item.proposalDecision;
      if (decision?.type) {
        const labels = {
          accepted: ['Orçamento aceito', 'Você aprovou esta proposta. A Infotech já pode organizar o início do projeto.', 'proposal-accepted'],
          rejected: ['Orçamento recusado', 'Você decidiu não continuar com esta proposta.', 'proposal-rejected'],
          change_requested: ['Alteração solicitada', 'A Infotech recebeu seu pedido de revisão e poderá enviar uma nova proposta.', 'proposal-change']
        };
        const [title, text, cssClass] = labels[decision.type] || labels.change_requested;
        proposalContent.innerHTML = `<div class="proposal-result ${cssClass}"><strong>${title}</strong><p>${text}</p>${decision.note ? `<div class="proposal-note"><span>Mensagem enviada</span><p>${escapeHtml(decision.note)}</p></div>` : ''}<small>Decisão registrada em ${formatDate(decision.decidedAt)}</small></div>`;
        return;
      }
      proposalContent.innerHTML = `<div class="proposal-actions"><button class="btn proposal-accept" type="button" data-proposal-action="accepted"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"></path></svg>Aceitar orçamento</button><button class="btn btn-outline proposal-change-button" type="button" data-proposal-action="change"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg>Pedir alteração</button><button class="btn btn-danger proposal-reject" type="button" data-proposal-action="rejected"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.3 19.71 2.89 18.3 9.17 12 2.89 5.71 4.3 4.29l6.29 6.3 6.3-6.3z"></path></svg>Recusar</button></div><form class="proposal-change-form" id="proposal-change-form" hidden><label for="proposal-change-note">O que você gostaria de alterar?</label><textarea id="proposal-change-note" maxlength="1000" rows="4" placeholder="Explique o valor, prazo ou condição que gostaria de revisar."></textarea><div class="proposal-change-footer"><button class="btn btn-outline" type="button" data-cancel-change>Cancelar</button><button class="btn auth-primary" type="submit">Enviar pedido de alteração</button></div><p class="form-message" id="proposal-feedback" aria-live="polite"></p></form>`;
      const saveDecision = (type, note = '') => {
        item.proposalDecision = { type, note, decidedAt: new Date().toISOString(), readByAdmin: false };
        if (type === 'accepted') item.status = 'Aprovada';
        if (type === 'rejected') item.status = 'Cancelada';
        if (type === 'change_requested') {
          item.status = 'Alteração solicitada';
          if (note) item.messages.push({ id: messageId(), sender:'client', senderName: currentUser.name || item.ownerName || 'Cliente', text: `Pedido de alteração do orçamento: ${note}`, sentAt:new Date().toISOString(), readByClient:true, readByAdmin:false });
        }
        item.updatedAt = item.proposalDecision.decidedAt;
        saveRequests(allItems);
        if (status) { status.textContent = item.status; status.className = `status ${statusClass(item.status)}`; }
        renderProposalDecision();
        updateClientChat?.();
        window.dispatchEvent(new CustomEvent('infotech:proposal-decision', { detail: { requestId: item.id, type } }));
      };
      proposalContent.querySelector('[data-proposal-action="accepted"]')?.addEventListener('click', () => {
        if (confirm('Confirmar a aceitação deste orçamento?')) saveDecision('accepted');
      });
      proposalContent.querySelector('[data-proposal-action="rejected"]')?.addEventListener('click', () => {
        if (confirm('Tem certeza de que deseja recusar este orçamento?')) saveDecision('rejected');
      });
      const changeForm = proposalContent.querySelector('#proposal-change-form');
      proposalContent.querySelector('[data-proposal-action="change"]')?.addEventListener('click', () => {
        changeForm.hidden = false;
        proposalContent.querySelector('#proposal-change-note')?.focus();
      });
      proposalContent.querySelector('[data-cancel-change]')?.addEventListener('click', () => { changeForm.hidden = true; });
      changeForm?.addEventListener('submit', event => {
        event.preventDefault();
        const note = proposalContent.querySelector('#proposal-change-note')?.value.trim();
        const feedback = proposalContent.querySelector('#proposal-feedback');
        if (!note) {
          feedback.textContent = 'Explique qual alteração você deseja solicitar.';
          feedback.className = 'form-message error';
          return;
        }
        saveDecision('change_requested', note);
      });
    };

    item.messages = Array.isArray(item.messages) ? item.messages : [];
    const clientThread = document.getElementById('client-chat-thread');
    const clientCount = detail.querySelector('[data-client-message-count]');
    const updateClientChat = () => {
      renderChat(clientThread, item.messages, 'client');
      installMessageReadTracking(clientThread, item, allItems, 'client');
      if (clientCount) clientCount.textContent = `${item.messages.length} ${item.messages.length === 1 ? 'mensagem' : 'mensagens'}`;
    };
    updateClientChat();
    renderProposalDecision();
    const clientChatForm = document.getElementById('client-chat-form');
    clientChatForm?.addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('client-chat-message');
      const feedback = document.getElementById('client-chat-feedback');
      const text = input.value.trim();
      if (!text) {
        feedback.textContent = 'Escreva uma mensagem antes de enviar.';
        feedback.className = 'form-message error';
        return;
      }
      item.messages.push({ id: messageId(), sender:'client', senderName: currentUser.name || item.ownerName || 'Cliente', text, sentAt:new Date().toISOString(), readByClient:true, readByAdmin:false });
      item.updatedAt = new Date().toISOString();
      saveRequests(allItems);
      input.value = '';
      feedback.textContent = 'Mensagem enviada para a Infotech.';
      feedback.className = 'form-message success';
      updateClientChat();
    });

    const timeline = document.getElementById('request-status-timeline');
    if (timeline) {
      const stages = ['Enviada','Em análise','Orçamento enviado','Em andamento','Concluída'];
      const mappedStatus = item.status === 'Lida' ? 'Em análise' : ['Aguardando aprovação','Aprovada','Alteração solicitada'].includes(item.status) ? 'Orçamento enviado' : item.status;
      const currentIndex = Math.max(0, stages.indexOf(mappedStatus));
      [...timeline.children].forEach((li,index) => {
        li.classList.remove('done','current');
        if (index < currentIndex) li.classList.add('done');
        else if (index === currentIndex) li.classList.add('current');
      });
    }
  }
})();
