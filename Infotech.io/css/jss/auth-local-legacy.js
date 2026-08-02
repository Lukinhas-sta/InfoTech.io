(() => {
  const currentUserKey = 'infotechDemoUser';
  const accountsKey = 'infotechDemoAccounts';
  const params = new URLSearchParams(window.location.search);
  const allowedDestinations = new Set(['painel-cliente.html', 'nova-solicitacao.html', 'perfil.html']);
  const requestedDestination = params.get('destino');
  const destination = allowedDestinations.has(requestedDestination) ? requestedDestination : 'painel-cliente.html';
  const destinationQuery = destination !== 'painel-cliente.html' ? `?destino=${encodeURIComponent(destination)}` : '';

  const normalizeEmail = value => String(value || '').trim().toLowerCase();
  const safeJson = (key, fallback) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  };
  const readCurrentUser = () => safeJson(currentUserKey, {});
  const readAccounts = () => {
    const accounts = safeJson(accountsKey, []);
    return Array.isArray(accounts) ? accounts : [];
  };
  const saveAccounts = accounts => {
    try { localStorage.setItem(accountsKey, JSON.stringify(accounts)); } catch {}
  };
  const saveCurrentUser = user => {
    try { localStorage.setItem(currentUserKey, JSON.stringify(user)); } catch {}
  };
  const findAccount = email => readAccounts().find(account => normalizeEmail(account.email) === normalizeEmail(email));
  const appendSecurityLog = (account, type, detail) => {
    const log = Array.isArray(account.securityLog) ? account.securityLog : [];
    log.unshift({ type, detail, at: new Date().toISOString() });
    account.securityLog = log.slice(0, 20);
  };
  const activateAccount = account => {
    const accounts = readAccounts();
    const index = accounts.findIndex(item => item.id === account.id || normalizeEmail(item.email) === normalizeEmail(account.email));
    const now = new Date().toISOString();
    const active = index >= 0 ? accounts[index] : account;
    active.sessionVersion = Number(active.sessionVersion || 1);
    active.lastLoginAt = now;
    active.lastActivityAt = now;
    active.updatedAt = now;
    if (index >= 0) { accounts[index] = active; saveAccounts(accounts); }
    saveCurrentUser({ id: active.id, name: active.name, email: active.email, sessionVersion: active.sessionVersion });
  };
  const makeAccount = ({ name, email, password }) => ({
    id: `USR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || '').trim() || normalizeEmail(email).split('@')[0] || 'Cliente',
    email: normalizeEmail(email),
    password: String(password || ''),
    status: 'active',
    sessionVersion: 1,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    securityLog: []
  });

  document.querySelectorAll('[data-toggle-password]').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Ocultar' : 'Mostrar';
      button.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    });
  });

  const loginForm = document.getElementById('demo-login-form');
  if (loginForm) loginForm.addEventListener('submit', event => {
    event.preventDefault();
    const message = document.getElementById('login-message');
    if (!loginForm.checkValidity()) {
      message.textContent = 'Preencha um e-mail válido e uma senha de teste.';
      message.className = 'form-message error';
      loginForm.reportValidity();
      return;
    }

    const email = normalizeEmail(loginForm.elements.email.value);
    const password = loginForm.elements.password.value;
    let account = findAccount(email);

    if (!account) {
      message.textContent = 'Conta não encontrada neste navegador. Crie uma conta de demonstração primeiro.';
      message.className = 'form-message error';
      return;
    }

    if (account.status === 'blocked') {
      message.textContent = 'Esta conta foi bloqueada pela Infotech. Entre em contato pelo canal de atendimento para solicitar uma revisão.';
      message.className = 'form-message error';
      return;
    }

    if (account.password !== password) {
      message.textContent = 'A senha de demonstração não corresponde a esta conta.';
      message.className = 'form-message error';
      return;
    }

    activateAccount(account);
    message.textContent = 'Entrada liberada. Abrindo sua área...';
    message.className = 'form-message success';
    window.setTimeout(() => { window.location.href = destination; }, 400);
  });

  const recoveryForm = document.getElementById('demo-recovery-form');
  if (recoveryForm && params.get('email')) recoveryForm.elements.email.value = normalizeEmail(params.get('email'));
  if (recoveryForm) recoveryForm.addEventListener('submit', event => {
    event.preventDefault();
    const message = document.getElementById('recovery-message');
    if (!recoveryForm.checkValidity()) {
      message.textContent = 'Confira o e-mail e preencha as duas senhas corretamente.';
      message.className = 'form-message error';
      recoveryForm.reportValidity();
      return;
    }

    const email = normalizeEmail(recoveryForm.elements.email.value);
    const password = String(recoveryForm.elements.password.value || '');
    const confirmPassword = String(recoveryForm.elements.confirmPassword.value || '');

    if (password !== confirmPassword) {
      message.textContent = 'As senhas não coincidem.';
      message.className = 'form-message error';
      return;
    }

    const accounts = readAccounts();
    const accountIndex = accounts.findIndex(account => normalizeEmail(account.email) === email);
    if (accountIndex < 0) {
      message.textContent = 'Nenhuma conta foi encontrada com este e-mail neste navegador.';
      message.className = 'form-message error';
      return;
    }

    accounts[accountIndex].password = password;
    accounts[accountIndex].sessionVersion = Number(accounts[accountIndex].sessionVersion || 1) + 1;
    accounts[accountIndex].passwordChangedAt = new Date().toISOString();
    accounts[accountIndex].updatedAt = new Date().toISOString();
    appendSecurityLog(accounts[accountIndex], 'password_reset', 'Senha redefinida pelo fluxo de recuperação local.');
    saveAccounts(accounts);

    const current = readCurrentUser();
    if (normalizeEmail(current.email) === email) {
      try { localStorage.removeItem(currentUserKey); } catch {}
    }

    message.textContent = 'Senha redefinida. Voltando para a tela de entrada...';
    message.className = 'form-message success';
    window.setTimeout(() => {
      window.location.href = `login.html${destinationQuery}`;
    }, 700);
  });

  const registerForm = document.getElementById('demo-register-form');
  if (registerForm) registerForm.addEventListener('submit', event => {
    event.preventDefault();
    const message = document.getElementById('register-message');
    if (!registerForm.checkValidity()) {
      message.textContent = 'Confira os campos e aceite o aviso da demonstração.';
      message.className = 'form-message error';
      registerForm.reportValidity();
      return;
    }

    const email = normalizeEmail(registerForm.elements.email.value);
    if (findAccount(email)) {
      message.textContent = 'Já existe uma conta de demonstração com este e-mail. Volte para entrar.';
      message.className = 'form-message error';
      return;
    }

    const account = makeAccount({
      name: registerForm.elements.name.value,
      email,
      password: registerForm.elements.password.value
    });
    const accounts = readAccounts();
    accounts.push(account);
    saveAccounts(accounts);
    activateAccount(account);

    message.textContent = 'Conta criada. Abrindo sua área...';
    message.className = 'form-message success';
    window.setTimeout(() => { window.location.href = destination; }, 450);
  });

  const continueLink = document.querySelector('[data-continue-demo]');
  if (continueLink) {
    continueLink.addEventListener('click', event => {
      event.preventDefault();
      const email = 'visitante@demo.infotech';
      let account = findAccount(email);
      if (!account) {
        account = makeAccount({ name: 'Visitante', email, password: 'demo' });
        const accounts = readAccounts();
        accounts.push(account);
        saveAccounts(accounts);
      }
      activateAccount(account);
      window.location.href = destination;
    });
  }

  const profileForm = document.getElementById('demo-profile-form');
  if (profileForm) {
    const current = readCurrentUser();
    profileForm.elements.name.value = current.name || '';
    profileForm.elements.email.value = current.email || '';
    profileForm.addEventListener('submit', event => {
      event.preventDefault();
      const message = document.getElementById('profile-message');
      if (!profileForm.checkValidity()) {
        message.textContent = 'Confira o nome e o e-mail.';
        message.className = 'form-message error';
        profileForm.reportValidity();
        return;
      }
      const newName = profileForm.elements.name.value.trim();
      const newEmail = normalizeEmail(profileForm.elements.email.value);
      const accounts = readAccounts();
      const currentIndex = accounts.findIndex(account => account.id === current.id || normalizeEmail(account.email) === normalizeEmail(current.email));
      const duplicate = accounts.some((account, index) => index !== currentIndex && normalizeEmail(account.email) === newEmail);
      if (duplicate) {
        message.textContent = 'Esse e-mail já pertence a outra conta de demonstração.';
        message.className = 'form-message error';
        return;
      }
      if (currentIndex >= 0) {
        accounts[currentIndex].name = newName;
        accounts[currentIndex].email = newEmail;
        saveAccounts(accounts);
      }
      const requests = safeJson('infotechDemoRequests', []);
      if (Array.isArray(requests)) {
        requests.forEach(request => {
          if (normalizeEmail(request.ownerEmail) === normalizeEmail(current.email)) {
            request.ownerEmail = newEmail;
            request.ownerName = newName;
          }
        });
        try { localStorage.setItem('infotechDemoRequests', JSON.stringify(requests)); } catch {}
      }
      saveCurrentUser({ id: current.id, name: newName, email: newEmail });
      message.textContent = 'Perfil atualizado neste navegador.';
      message.className = 'form-message success';
      document.querySelectorAll('[data-demo-name]').forEach(el => { el.textContent = newName; });
      document.querySelectorAll('[data-demo-email]').forEach(el => { el.textContent = newEmail; });
    });
  }


  const passwordForm = document.getElementById('demo-password-form');
  if (passwordForm) {
    passwordForm.addEventListener('submit', event => {
      event.preventDefault();
      const message = document.getElementById('password-message');
      if (!passwordForm.checkValidity()) {
        message.textContent = 'Confira todos os campos da senha.';
        message.className = 'form-message error';
        passwordForm.reportValidity();
        return;
      }
      const current = readCurrentUser();
      const accounts = readAccounts();
      const index = accounts.findIndex(account => account.id === current.id || normalizeEmail(account.email) === normalizeEmail(current.email));
      if (index < 0) {
        message.textContent = 'Conta não encontrada neste navegador.';
        message.className = 'form-message error';
        return;
      }
      const currentPassword = String(passwordForm.elements.currentPassword.value || '');
      const newPassword = String(passwordForm.elements.newPassword.value || '');
      const confirmPassword = String(passwordForm.elements.confirmPassword.value || '');
      if (accounts[index].password !== currentPassword) {
        message.textContent = 'A senha atual está incorreta.';
        message.className = 'form-message error';
        return;
      }
      if (newPassword !== confirmPassword) {
        message.textContent = 'A confirmação não corresponde à nova senha.';
        message.className = 'form-message error';
        return;
      }
      if (newPassword === currentPassword) {
        message.textContent = 'Escolha uma senha diferente da atual.';
        message.className = 'form-message error';
        return;
      }
      accounts[index].password = newPassword;
      accounts[index].sessionVersion = Number(accounts[index].sessionVersion || 1) + 1;
      accounts[index].passwordChangedAt = new Date().toISOString();
      accounts[index].updatedAt = new Date().toISOString();
      appendSecurityLog(accounts[index], 'password_change', 'Senha alterada pelo próprio cliente no perfil.');
      saveAccounts(accounts);
      activateAccount(accounts[index]);
      passwordForm.reset();
      message.textContent = 'Senha alterada com sucesso. As outras sessões foram encerradas.';
      message.className = 'form-message success';
    });
  }

  let user = readCurrentUser();
  const protectedPage = document.body.hasAttribute('data-client-protected');
  const sessionAccount = user.email ? findAccount(user.email) : null;
  const sessionInvalid = user.email && sessionAccount && Number(user.sessionVersion || 1) !== Number(sessionAccount.sessionVersion || 1);
  if (user.email && (sessionAccount?.status === 'blocked' || sessionInvalid)) {
    try { localStorage.removeItem(currentUserKey); } catch {}
    user = {};
    const target = location.pathname.split('/').pop() || 'painel-cliente.html';
    if (protectedPage) {
      const reason = sessionInvalid ? 'sessao=1' : 'bloqueada=1';
      location.href = `login.html?${reason}&destino=${encodeURIComponent(allowedDestinations.has(target) ? target : 'painel-cliente.html')}`;
      return;
    }
  }
  if (user.email && sessionAccount && !sessionInvalid && sessionAccount.status !== 'blocked') {
    const last = new Date(sessionAccount.lastActivityAt || 0).getTime();
    if (!last || Date.now() - last > 60000) {
      const accounts = readAccounts();
      const index = accounts.findIndex(account => account.id === sessionAccount.id || normalizeEmail(account.email) === normalizeEmail(sessionAccount.email));
      if (index >= 0) {
        accounts[index].lastActivityAt = new Date().toISOString();
        saveAccounts(accounts);
      }
    }
  }
  if (protectedPage && !user.email) {
    const target = location.pathname.split('/').pop() || 'painel-cliente.html';
    location.href = `login.html?destino=${encodeURIComponent(allowedDestinations.has(target) ? target : 'painel-cliente.html')}`;
    return;
  }

  if (loginForm && params.get('sessao') === '1') {
    const message = document.getElementById('login-message');
    if (message) {
      message.textContent = 'Sua sessão foi encerrada. Entre novamente para continuar.';
      message.className = 'form-message error';
    }
  }

  if (loginForm && params.get('bloqueada') === '1') {
    const message = document.getElementById('login-message');
    if (message) {
      message.textContent = 'Sua sessão foi encerrada porque esta conta está bloqueada.';
      message.className = 'form-message error';
    }
  }

  document.querySelectorAll('[data-demo-name]').forEach(el => { el.textContent = user.name || 'Cliente'; });
  document.querySelectorAll('[data-demo-email]').forEach(el => { el.textContent = user.email || 'Não informado'; });
  document.querySelectorAll('[data-demo-logout]').forEach(el => el.addEventListener('click', () => {
    try { localStorage.removeItem(currentUserKey); } catch {}
  }));

  document.querySelectorAll('[data-preserve-destination]').forEach(link => {
    const base = link.getAttribute('href').split('?')[0];
    link.href = base + destinationQuery;
  });


  // Infotech.io 4.0 — Parte 3: navegação inteligente da conta
  const publicHeader = document.querySelector('.site-header .navbar');
  const currentPage = location.pathname.split('/').pop() || 'index.html';

  const makeIcon = path => `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${path}"></path></svg>`;
  const userIcon = makeIcon('M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14z');
  const chevronIcon = makeIcon('M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4z');

  if (publicHeader && !document.querySelector('.account-nav')) {
    const accountWrap = document.createElement('div');
    accountWrap.className = 'account-nav';

    if (user.email) {
      const firstName = String(user.name || 'Cliente').trim().split(/\\s+/)[0];
      accountWrap.innerHTML = `
        <button class="account-trigger" type="button" aria-expanded="false" aria-haspopup="true">
          <span class="account-avatar">${userIcon}</span>
          <span class="account-trigger-text"><small>Olá,</small><strong>${firstName}</strong></span>
          <span class="account-chevron">${chevronIcon}</span>
        </button>
        <div class="account-dropdown" hidden>
          <div class="account-summary"><strong>${user.name || 'Cliente'}</strong><span>${user.email}</span></div>
          <a href="perfil.html">Meu Perfil</a>
          <a href="painel-cliente.html">Minhas Solicitações</a>
          <a href="nova-solicitacao.html">Nova Solicitação</a>
          <button type="button" class="account-logout">Sair da conta</button>
        </div>`;

      const trigger = accountWrap.querySelector('.account-trigger');
      const dropdown = accountWrap.querySelector('.account-dropdown');
      const closeAccount = () => {
        dropdown.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        accountWrap.classList.remove('open');
      };
      trigger.addEventListener('click', event => {
        event.stopPropagation();
        const opening = dropdown.hidden;
        dropdown.hidden = !opening;
        trigger.setAttribute('aria-expanded', String(opening));
        accountWrap.classList.toggle('open', opening);
      });
      document.addEventListener('click', event => {
        if (!accountWrap.contains(event.target)) closeAccount();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeAccount();
      });
      accountWrap.querySelector('.account-logout').addEventListener('click', () => {
        try { localStorage.removeItem(currentUserKey); } catch {}
        location.href = 'index.html';
      });
    } else {
      accountWrap.innerHTML = `<a class="account-login-link" href="login.html">${userIcon}<span>Área do Cliente</span></a>`;
    }
    publicHeader.appendChild(accountWrap);
  }

  // Links de solicitação pulam a tela de login quando a sessão está ativa.
  document.querySelectorAll('a[href^="login.html?destino="]').forEach(link => {
    if (!user.email) return;
    const linkParams = new URLSearchParams(link.getAttribute('href').split('?')[1] || '');
    const target = linkParams.get('destino');
    if (allowedDestinations.has(target)) link.href = target;
  });

  // Saudação discreta na Home para deixar claro que a conta continua conectada.
  if (user.email && currentPage === 'index.html' && !document.querySelector('.home-account-welcome')) {
    const heroCopy = document.querySelector('.hero-copy');
    const heroActions = document.querySelector('.hero-actions');
    if (heroCopy && heroActions) {
      const greeting = document.createElement('div');
      greeting.className = 'home-account-welcome';
      greeting.innerHTML = `<span>${userIcon}</span><p><strong>Olá, ${String(user.name || 'Cliente').trim().split(/\\s+/)[0]}!</strong> Sua conta está conectada.</p>`;
      heroCopy.insertBefore(greeting, heroActions);
    }
  }

})();
