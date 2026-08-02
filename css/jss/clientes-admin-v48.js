(() => {
  'use strict';

  const REQUESTS_KEY = 'infotechDemoRequests';
  const normalize = value => String(value || '').trim().toLowerCase();
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const safeJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const readRequests = () => { const value = safeJson(REQUESTS_KEY, []); return Array.isArray(value) ? value : []; };
  const formatDate = value => {
    if (!value) return 'Não informado';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Não informado';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  };
  const initials = name => String(name || 'Cliente').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'CL';
  const statusClass = status => {
    if (status === 'Concluída') return 'status-done';
    if (status === 'Cancelada') return 'status-cancelled';
    if (['Em andamento', 'Aprovada'].includes(status)) return 'status-progress';
    if (['Em análise', 'Lida', 'Orçamento enviado', 'Aguardando aprovação', 'Alteração solicitada'].includes(status)) return 'status-analysis';
    return 'status-sent';
  };
  const client = window.infotechSupabase;
  if (!client) return;

  const loadUsers = async () => {
    const { data, error } = await client.rpc('admin_list_clients');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  const sendPasswordReset = async email => {
    const redirectTo = new URL('recuperar-senha.html', window.location.href).href;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  };

  const setClientBlocked = async (id, blocked) => {
    const { data, error } = await client.rpc('admin_set_client_blocked', {
      p_client_id: id,
      p_blocked: Boolean(blocked)
    });
    if (error) throw error;
    return data;
  };

  const list = document.getElementById('admin-clients-list');
  if (list) {
    const search = document.getElementById('admin-client-search');
    let users = [];

    const render = () => {
      const query = normalize(search?.value);
      const rows = users.filter(user => [user.full_name, user.email, user.role].some(value => normalize(value).includes(query)));
      document.querySelectorAll('[data-client-total]').forEach(el => el.textContent = String(users.length));
      document.querySelectorAll('[data-client-confirmed]').forEach(el => el.textContent = String(users.filter(user => user.email_confirmed_at).length));
      document.querySelectorAll('[data-client-users]').forEach(el => el.textContent = String(users.filter(user => user.role !== 'admin').length));
      document.querySelectorAll('[data-client-admins]').forEach(el => el.textContent = String(users.filter(user => user.role === 'admin').length));
      const count = document.querySelector('[data-client-results-count]');
      if (count) count.textContent = `${rows.length} ${rows.length === 1 ? 'conta encontrada' : 'contas encontradas'}`;

      if (!rows.length) {
        list.innerHTML = '<div class="empty-state"><h3>Nenhuma conta encontrada</h3><p>Tente pesquisar por outro nome ou e-mail.</p></div>';
        return;
      }

      list.innerHTML = rows.map(user => {
        const confirmed = Boolean(user.email_confirmed_at);
        const blocked = Boolean(user.is_blocked);
        const roleLabel = user.role === 'admin' ? 'Administrador' : 'Cliente';
        return `<article class="client-card">
          <div class="client-avatar" aria-hidden="true">${escapeHtml(initials(user.full_name))}</div>
          <div class="client-main">
            <h3>${escapeHtml(user.full_name || user.email?.split('@')[0] || 'Cliente')}</h3>
            <p>${escapeHtml(user.email || 'E-mail não informado')}</p>
            <div class="client-meta"><span>${escapeHtml(roleLabel)}</span><span>Cadastro: ${formatDate(user.created_at)}</span><span>Último login: ${formatDate(user.last_sign_in_at)}</span></div>
          </div>
          <div class="client-actions">
            <span class="client-status ${blocked || !confirmed ? 'is-blocked' : ''}">${blocked ? 'Bloqueado' : (confirmed ? 'Ativo' : 'Pendente')}</span>
            ${user.role !== 'admin' ? `<button class="btn btn-outline" type="button" data-toggle-block="${escapeHtml(user.id)}" data-blocked="${blocked ? '1' : '0'}">${blocked ? 'Reativar' : 'Bloquear'}</button>` : ''}
            <button class="btn btn-outline" type="button" data-reset-password="${escapeHtml(user.email)}">Redefinir senha</button>
            <a class="btn btn-outline" href="cliente-admin.html?id=${encodeURIComponent(user.id)}">Ver perfil</a>
          </div>
        </article>`;
      }).join('');
    };

    search?.addEventListener('input', render);
    list.addEventListener('click', async event => {
      const blockButton = event.target.closest('[data-toggle-block]');
      if (blockButton) {
        const id = blockButton.dataset.toggleBlock;
        const currentlyBlocked = blockButton.dataset.blocked === '1';
        const action = currentlyBlocked ? 'reativar' : 'bloquear';
        if (!window.confirm(`Deseja ${action} esta conta?`)) return;
        blockButton.disabled = true;
        const original = blockButton.textContent;
        blockButton.textContent = currentlyBlocked ? 'Reativando...' : 'Bloqueando...';
        try {
          await setClientBlocked(id, !currentlyBlocked);
          users = users.map(user => String(user.id) === String(id) ? {...user, is_blocked: !currentlyBlocked} : user);
          render();
          window.alert(currentlyBlocked ? 'Conta reativada.' : 'Conta bloqueada. O cliente não poderá entrar no sistema.');
        } catch (error) {
          console.error(error);
          blockButton.disabled = false;
          blockButton.textContent = original;
          window.alert('Não foi possível alterar o bloqueio. Execute o SQL da versão 5.1.1 no Supabase.');
        }
        return;
      }
      const button = event.target.closest('[data-reset-password]');
      if (!button) return;
      const email = button.dataset.resetPassword;
      if (!window.confirm(`Enviar um link de redefinição de senha para ${email}?`)) return;
      button.disabled = true;
      const original = button.textContent;
      button.textContent = 'Enviando...';
      try {
        await sendPasswordReset(email);
        button.textContent = 'Link enviado';
        window.alert('Link de redefinição enviado. Peça ao cliente para verificar a caixa de entrada e o spam.');
      } catch (error) {
        console.error(error);
        button.textContent = original;
        window.alert('Não foi possível enviar o link agora. Verifique os limites de e-mail do Supabase e tente novamente.');
      } finally {
        setTimeout(() => { button.disabled = false; button.textContent = original; }, 1800);
      }
    });

    list.innerHTML = '<div class="empty-state"><h3>Carregando contas...</h3><p>Buscando os usuários cadastrados no Supabase.</p></div>';
    loadUsers().then(data => { users = data; render(); }).catch(error => {
      console.error(error);
      list.innerHTML = '<div class="empty-state"><h3>Não foi possível carregar as contas</h3><p>Execute o arquivo SQL desta versão no Supabase e atualize a página.</p></div>';
    });
  }

  const detail = document.getElementById('admin-client-detail');
  if (detail) {
    const id = new URLSearchParams(location.search).get('id');
    const requests = readRequests();
    loadUsers().then(users => {
      const user = users.find(item => String(item.id) === String(id));
      if (!user) {
        detail.innerHTML = '<div class="empty-state"><h1>Conta não encontrada</h1><p>Volte para a lista e escolha uma conta existente.</p><a class="btn btn-outline" href="clientes-admin.html">Voltar para clientes</a></div>';
        return;
      }
      const items = requests.filter(request => normalize(request.ownerEmail) === normalize(user.email));
      const attachments = items.reduce((total, item) => total + (Array.isArray(item.attachments) ? item.attachments.length : 0), 0);
      const messages = items.reduce((total, item) => total + (Array.isArray(item.messages) ? item.messages.length : 0), 0);
      const name = user.full_name || user.email?.split('@')[0] || 'Cliente';
      document.querySelectorAll('[data-client-name]').forEach(el => el.textContent = name);
      document.querySelectorAll('[data-client-email]').forEach(el => el.textContent = user.email || 'Não informado');
      document.querySelectorAll('[data-client-avatar]').forEach(el => el.textContent = initials(name));
      document.querySelectorAll('[data-client-role]').forEach(el => el.textContent = user.role === 'admin' ? 'Administrador' : 'Cliente');
      document.querySelectorAll('[data-client-created]').forEach(el => el.textContent = formatDate(user.created_at));
      document.querySelectorAll('[data-client-last-login]').forEach(el => el.textContent = formatDate(user.last_sign_in_at));
      document.querySelectorAll('[data-client-confirmed]').forEach(el => el.textContent = formatDate(user.email_confirmed_at));
      document.querySelectorAll('[data-client-request-count]').forEach(el => el.textContent = String(items.length));
      document.querySelectorAll('[data-client-project-count]').forEach(el => el.textContent = String(items.filter(item => ['Aprovada', 'Em andamento', 'Concluída'].includes(item.status)).length));
      document.querySelectorAll('[data-client-file-count]').forEach(el => el.textContent = String(attachments));
      document.querySelectorAll('[data-client-message-count]').forEach(el => el.textContent = String(messages));
      document.querySelectorAll('[data-client-confirmation-status]').forEach(el => {
        const confirmed = Boolean(user.email_confirmed_at);
        const blocked = Boolean(user.is_blocked);
        el.textContent = blocked ? 'Conta bloqueada' : (confirmed ? 'Conta ativa' : 'Confirmação pendente');
        el.classList.toggle('is-blocked', blocked || !confirmed);
      });
      const blockControl = document.querySelector('[data-client-block-toggle]');
      if (blockControl && user.role !== 'admin') {
        const syncBlockLabel = () => { blockControl.textContent = user.is_blocked ? 'Reativar conta' : 'Bloquear conta'; };
        syncBlockLabel();
        blockControl.addEventListener('click', async () => {
          const next = !Boolean(user.is_blocked);
          if (!window.confirm(next ? 'Bloquear esta conta?' : 'Reativar esta conta?')) return;
          blockControl.disabled = true;
          try { await setClientBlocked(user.id, next); user.is_blocked = next; syncBlockLabel(); document.querySelectorAll('[data-client-confirmation-status]').forEach(el=>{el.textContent=next?'Conta bloqueada':'Conta ativa';el.classList.toggle('is-blocked',next);}); window.alert(next?'Conta bloqueada.':'Conta reativada.'); }
          catch(error){ console.error(error); window.alert('Não foi possível alterar o bloqueio.'); }
          finally { blockControl.disabled = false; }
        });
      } else if (blockControl) blockControl.hidden = true;
      const reset = document.querySelector('[data-send-password-reset]');
      reset?.addEventListener('click', async () => {
        if (!window.confirm(`Enviar um link de redefinição de senha para ${user.email}?`)) return;
        reset.disabled = true;
        const original = reset.textContent;
        reset.textContent = 'Enviando...';
        try {
          await sendPasswordReset(user.email);
          reset.textContent = 'Link enviado';
          window.alert('Link de redefinição enviado para o cliente.');
        } catch (error) {
          console.error(error);
          reset.textContent = original;
          window.alert('Não foi possível enviar o link agora. Tente novamente mais tarde.');
        } finally {
          setTimeout(() => { reset.disabled = false; reset.textContent = original; }, 1800);
        }
      });
      const requestList = document.getElementById('admin-client-requests');
      if (requestList) requestList.innerHTML = items.length ? items.map(item => `<article class="client-request-item"><div><h3>${escapeHtml(item.title || item.service || 'Solicitação')}</h3><p>${escapeHtml(item.protocol || '')} · ${escapeHtml(item.status || 'Enviada')}</p></div><a class="btn btn-outline" href="admin-solicitacao.html?id=${encodeURIComponent(item.id || item.protocol || '')}">Abrir solicitação</a></article>`).join('') : '<div class="empty-state"><h3>Nenhuma solicitação</h3><p>Esta conta ainda não possui solicitações vinculadas.</p></div>';
    }).catch(error => {
      console.error(error);
      detail.innerHTML = '<div class="empty-state"><h1>Não foi possível carregar a conta</h1><p>Execute o arquivo SQL desta versão no Supabase e tente novamente.</p><a class="btn btn-outline" href="clientes-admin.html">Voltar</a></div>';
    });
  }
})();
