(() => {
  const requestsKey = 'infotechDemoRequests';
  const userKey = 'infotechDemoUser';
  const maxBytes = 1024 * 1024;
  const maxFiles = 3;
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const readRequests = () => { const data = readJson(requestsKey, []); return Array.isArray(data) ? data : []; };
  const saveRequests = data => { try { localStorage.setItem(requestsKey, JSON.stringify(data)); return true; } catch { return false; } };
  const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const formatDate = iso => { try { return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso)); } catch { return 'Data não informada'; } };
  const formatBytes = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;
  const id = () => `FILE-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const params = new URLSearchParams(location.search);
  const requestId = params.get('id');
  const highlightedFileId = params.get('arquivo');
  const isAdminPage = !!document.getElementById('admin-attachments-form');
  const form = document.getElementById(isAdminPage ? 'admin-attachments-form' : 'client-attachments-form');
  const input = document.getElementById(isAdminPage ? 'admin-attachments-input' : 'client-attachments-input');
  const list = document.getElementById(isAdminPage ? 'admin-attachments-list' : 'client-attachments-list');
  const feedback = document.getElementById(isAdminPage ? 'admin-attachments-feedback' : 'client-attachments-feedback');
  if (!form || !input || !list || !requestId) return;

  const currentUser = readJson(userKey, {});
  const getContext = () => {
    const items = readRequests();
    const item = items.find(entry => entry.id === requestId);
    if (!item) return { items, item: null };
    if (!isAdminPage && String(item.ownerEmail || '').toLowerCase() !== String(currentUser.email || '').toLowerCase()) return { items, item: null };
    item.attachments = Array.isArray(item.attachments) ? item.attachments : [];
    return { items, item };
  };

  const markVisibleFilesAsRead = (items, item) => {
    let changed = false;
    item.attachments.forEach(file => {
      if (isAdminPage && file.sender === 'client' && !file.readByAdmin) {
        file.readByAdmin = true;
        file.readByAdminAt = new Date().toISOString();
        changed = true;
      }
      if (!isAdminPage && file.sender === 'admin' && !file.readByClient) {
        file.readByClient = true;
        file.readByClientAt = new Date().toISOString();
        changed = true;
      }
    });
    if (changed) saveRequests(items);
  };

  const iconSvg = type => {
    const image = String(type).startsWith('image/');
    const pdf = type === 'application/pdf';
    const path = image ? 'M4 5h16v14H4V5zm2 2v10h12V7H6zm1 8 3-4 2 2 2-3 3 5H7z' : pdf ? 'M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 13h8v2H8v-2zm0 4h6v2H8v-2z' : 'M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2z';
    return `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${path}"/></svg>`;
  };

  const render = () => {
    const { items, item } = getContext();
    if (!item) { list.innerHTML = '<div class="attachments-empty"><strong>Solicitação não encontrada</strong><p>Não foi possível carregar os arquivos.</p></div>'; return; }
    markVisibleFilesAsRead(items, item);
    const files = item.attachments;
    document.querySelectorAll('[data-attachment-count]').forEach(el => el.textContent = `${files.length} ${files.length === 1 ? 'arquivo' : 'arquivos'}`);
    if (!files.length) {
      list.innerHTML = '<div class="attachments-empty"><strong>Nenhum arquivo enviado</strong><p>Os arquivos relacionados a esta solicitação aparecerão aqui.</p></div>';
      return;
    }
    list.innerHTML = files.map(file => {
      const own = isAdminPage ? file.sender === 'admin' : file.sender === 'client';
      const preview = String(file.type).startsWith('image/') ? `<img src="${file.data}" alt="Prévia de ${escapeHtml(file.name)}">` : iconSvg(file.type);
      return `<article class="attachment-item${highlightedFileId === file.id ? ' attachment-highlight' : ''}" data-file-id="${escapeHtml(file.id)}"><div class="attachment-preview">${preview}</div><div class="attachment-info"><strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong><div class="attachment-meta"><span class="attachment-origin ${file.sender}">${file.sender === 'admin' ? 'Infotech' : escapeHtml(file.senderName || 'Cliente')}</span><span>${formatBytes(file.size || 0)}</span><span>${formatDate(file.sentAt)}</span></div></div><div class="attachment-buttons"><a class="attachment-action" href="${file.data}" download="${escapeHtml(file.name)}" title="Baixar arquivo" aria-label="Baixar ${escapeHtml(file.name)}"><svg viewBox="0 0 24 24"><path d="M11 4h2v9l3.5-3.5 1.4 1.4-5.9 5.9-5.9-5.9 1.4-1.4L11 13V4zM5 19h14v2H5v-2z"/></svg></a>${own ? `<button class="attachment-action attachment-delete" type="button" data-delete-file="${escapeHtml(file.id)}" title="Excluir arquivo" aria-label="Excluir ${escapeHtml(file.name)}"><svg viewBox="0 0 24 24"><path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7zm10-12H7v10h10V9zm-7 2h2v6h-2v-6zm4 0h2v6h-2v-6zM9 3h6l1 2h4v2H4V5h4l1-2z"/></svg></button>` : ''}</div></article>`;
    }).join('');
  };

  input.addEventListener('change', () => {
    const label = form.querySelector('.file-drop');
    label?.classList.toggle('file-selected', input.files.length > 0);
    const strong = label?.querySelector('strong');
    if (strong) strong.textContent = input.files.length ? `${input.files.length} arquivo(s) selecionado(s)` : (isAdminPage ? 'Adicionar arquivos da Infotech' : 'Escolher arquivos');
  });

  const toDataUrl = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    feedback.className = 'form-message';
    const selected = [...input.files];
    if (!selected.length) { feedback.textContent = 'Escolha pelo menos um arquivo.'; feedback.className = 'form-message error'; return; }
    if (selected.length > maxFiles) { feedback.textContent = `Escolha no máximo ${maxFiles} arquivos por vez.`; feedback.className = 'form-message error'; return; }
    const oversized = selected.find(file => file.size > maxBytes);
    if (oversized) { feedback.textContent = `O arquivo “${oversized.name}” ultrapassa o limite de 1 MB desta demonstração.`; feedback.className = 'form-message error'; return; }
    const { items, item } = getContext();
    if (!item) return;
    feedback.textContent = 'Preparando arquivos...';
    try {
      const sender = isAdminPage ? 'admin' : 'client';
      for (const file of selected) {
        item.attachments.push({ id:id(), name:file.name, type:file.type || 'application/octet-stream', size:file.size, data:await toDataUrl(file), sender, senderName:sender === 'admin' ? 'Infotech' : (currentUser.name || item.ownerName || 'Cliente'), sentAt:new Date().toISOString(), readByAdmin: sender === 'admin', readByClient: sender === 'client' });
      }
      item.updatedAt = new Date().toISOString();
      if (!saveRequests(items)) throw new Error('storage');
      input.value = '';
      form.querySelector('.file-drop')?.classList.remove('file-selected');
      const strong = form.querySelector('.file-drop strong');
      if (strong) strong.textContent = isAdminPage ? 'Adicionar arquivos da Infotech' : 'Escolher arquivos';
      feedback.textContent = selected.length === 1 ? 'Arquivo enviado com sucesso.' : 'Arquivos enviados com sucesso.';
      feedback.className = 'form-message success';
      render();
    } catch {
      feedback.textContent = 'Não foi possível salvar. O armazenamento deste navegador pode estar cheio; tente um arquivo menor.';
      feedback.className = 'form-message error';
    }
  });

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-delete-file]');
    if (!button) return;
    const { items, item } = getContext();
    if (!item) return;
    const file = item.attachments.find(entry => entry.id === button.dataset.deleteFile);
    const allowed = file && (isAdminPage ? file.sender === 'admin' : file.sender === 'client');
    if (!allowed) return;
    item.attachments = item.attachments.filter(entry => entry.id !== file.id);
    item.updatedAt = new Date().toISOString();
    saveRequests(items);
    feedback.textContent = 'Arquivo removido.';
    feedback.className = 'form-message success';
    render();
  });

  render();
})();
