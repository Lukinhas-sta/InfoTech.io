(() => {
  'use strict';

  const currentUserKey = 'infotechDemoUser'; // Compatibilidade temporária com solicitações locais.
  const accountsKey = 'infotechDemoAccounts'; // Espelho local; não armazena senhas na 5.0.1.
  const projectRef = 'rgngqumqzylthdiazvfu';
  const supabaseStorageKey = `sb-${projectRef}-auth-token`;
  const params = new URLSearchParams(window.location.search);
  const allowedDestinations = new Set(['painel-cliente.html', 'nova-solicitacao.html', 'perfil.html']);
  const requestedDestination = params.get('destino');
  const destination = allowedDestinations.has(requestedDestination) ? requestedDestination : 'painel-cliente.html';
  const destinationQuery = destination !== 'painel-cliente.html' ? `?destino=${encodeURIComponent(destination)}` : '';
  const config = window.INFOTECH_SUPABASE_CONFIG || {};

  const normalizeEmail = value => String(value || '').trim().toLowerCase();
  const safeJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const setMessage = (element, text, type = 'error') => {
    if (!element) return;
    element.textContent = text;
    element.className = `form-message ${type}`;
  };
  const setBusy = (form, busy) => {
    if (!form) return;
    form.querySelectorAll('button, input').forEach(el => { el.disabled = busy; });
    form.setAttribute('aria-busy', String(busy));
  };
  const readAccounts = () => {
    const accounts = safeJson(accountsKey, []);
    return Array.isArray(accounts) ? accounts : [];
  };
  const saveAccounts = accounts => {
    try { localStorage.setItem(accountsKey, JSON.stringify(accounts)); } catch {}
  };
  const readCurrentUser = () => safeJson(currentUserKey, {});
  const saveCurrentUser = user => {
    try { localStorage.setItem(currentUserKey, JSON.stringify(user)); } catch {}
  };
  const clearCurrentUser = () => {
    try { localStorage.removeItem(currentUserKey); } catch {}
  };
  const displayName = user => String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Cliente').trim();

  const mirrorUser = user => {
    if (!user?.email) { clearCurrentUser(); return {}; }
    const now = new Date().toISOString();
    const localUser = { id: user.id, name: displayName(user), email: normalizeEmail(user.email), provider: 'supabase' };
    saveCurrentUser(localUser);

    const accounts = readAccounts();
    const index = accounts.findIndex(item => item.id === user.id || normalizeEmail(item.email) === localUser.email);
    const prior = index >= 0 ? accounts[index] : {};
    const account = {
      ...prior,
      id: user.id,
      name: localUser.name,
      email: localUser.email,
      status: prior.status || 'active',
      provider: 'supabase',
      createdAt: prior.createdAt || user.created_at || now,
      lastLoginAt: now,
      lastActivityAt: now,
      updatedAt: now
    };
    delete account.password;
    if (index >= 0) accounts[index] = account; else accounts.push(account);
    saveAccounts(accounts);
    return localUser;
  };

  // Preenche o espelho antes dos outros scripts lerem o usuário, usando a sessão persistida pelo SDK.
  const cached = safeJson(supabaseStorageKey, null);
  if (cached?.user?.email) mirrorUser(cached.user);

  if (!config.url || !config.publishableKey || !window.supabase?.createClient) {
    console.error('Supabase não foi carregado ou não está configurado.');
    document.documentElement.classList.add('auth-config-error');
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.infotechSupabase = client;

  const getOnlineProfile = async userId => {
    if (!userId) return null;
    const { data, error } = await client.from('profiles').select('role,is_blocked').eq('id', userId).maybeSingle();
    if (error) console.warn('Não foi possível verificar o status da conta:', error.message);
    return data || null;
  };

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
  if (loginForm) loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = document.getElementById('login-message');
    if (!loginForm.checkValidity()) {
      setMessage(message, 'Preencha um e-mail válido e sua senha.');
      loginForm.reportValidity();
      return;
    }
    setBusy(loginForm, true);
    setMessage(message, 'Verificando sua conta...', 'success');
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(loginForm.elements.email.value),
      password: String(loginForm.elements.password.value || '')
    });
    if (error || !data.user) {
      setBusy(loginForm, false);
      setMessage(message, error?.message === 'Email not confirmed'
        ? 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
        : 'E-mail ou senha incorretos.');
      return;
    }
    const localAccount = readAccounts().find(a => a.id === data.user.id || normalizeEmail(a.email) === normalizeEmail(data.user.email));
    const onlineProfile = await getOnlineProfile(data.user.id);
    if (onlineProfile?.is_blocked || localAccount?.status === 'blocked') {
      await client.auth.signOut();
      clearCurrentUser();
      setBusy(loginForm, false);
      setMessage(message, 'Esta conta foi bloqueada pela Infotech. Entre em contato para solicitar a reativação.');
      return;
    }
    mirrorUser(data.user);
    setMessage(message, 'Entrada liberada. Abrindo sua área...', 'success');
    window.setTimeout(() => { window.location.href = destination; }, 350);
  });

  const registerForm = document.getElementById('demo-register-form');
  if (registerForm) registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = document.getElementById('register-message');
    if (!registerForm.checkValidity()) {
      setMessage(message, 'Confira os campos e aceite os termos de cadastro.');
      registerForm.reportValidity();
      return;
    }
    setBusy(registerForm, true);
    setMessage(message, 'Criando sua conta...', 'success');
    const name = String(registerForm.elements.name.value || '').trim();
    const email = normalizeEmail(registerForm.elements.email.value);
    const password = String(registerForm.elements.password.value || '');
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: new URL(`email-confirmado.html${destinationQuery}`, window.location.href).href
      }
    });
    if (error) {
      setBusy(registerForm, false);
      setMessage(message, error.message || 'Não foi possível criar a conta.');
      return;
    }
    if (data.session && data.user) {
      mirrorUser(data.user);
      setMessage(message, 'Conta criada. Abrindo sua área...', 'success');
      window.setTimeout(() => { window.location.href = destination; }, 450);
      return;
    }
    setBusy(registerForm, false);
    setMessage(message, 'Conta criada! Abra o e-mail de confirmação enviado pelo Supabase e depois faça login.', 'success');
  });

  const recoveryForm = document.getElementById('demo-recovery-form');
  const recoveryPasswordFields = recoveryForm ? [...recoveryForm.querySelectorAll('[name="password"], [name="confirmPassword"]')].map(input => input.closest('.password-field') || input) : [];
  const recoveryLabels = recoveryForm ? [...recoveryForm.querySelectorAll('label[for="recovery-password"], label[for="recovery-confirm-password"]')] : [];
  const recoveryEmailLabel = recoveryForm?.querySelector('label[for="recovery-email"]');
  let recoveryMode = window.location.hash.includes('type=recovery');
  const applyRecoveryMode = enabled => {
    recoveryMode = enabled;
    [...recoveryPasswordFields, ...recoveryLabels].forEach(el => { if (el) el.hidden = !enabled; });
    const emailInput = recoveryForm?.elements.email;
    if (emailInput) {
      if (recoveryEmailLabel) recoveryEmailLabel.hidden = enabled;
      emailInput.hidden = enabled;
      emailInput.required = !enabled;
    }
    if (recoveryForm) {
      const submit = recoveryForm.querySelector('[type="submit"]');
      if (submit) submit.textContent = enabled ? 'Salvar nova senha' : 'Enviar link de recuperação';
    }
  };
  if (recoveryForm) applyRecoveryMode(recoveryMode);

  if (recoveryForm) recoveryForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = document.getElementById('recovery-message');
    if (recoveryMode) {
      const password = String(recoveryForm.elements.password.value || '');
      const confirm = String(recoveryForm.elements.confirmPassword.value || '');
      if (password.length < 6 || password !== confirm) {
        setMessage(message, password !== confirm ? 'As senhas não coincidem.' : 'Use uma senha com pelo menos 6 caracteres.');
        return;
      }
      setBusy(recoveryForm, true);
      const { data, error } = await client.auth.updateUser({ password });
      if (error) {
        setBusy(recoveryForm, false);
        setMessage(message, error.message || 'Não foi possível atualizar a senha.');
        return;
      }
      if (data.user) mirrorUser(data.user);
      setMessage(message, 'Senha alterada. Voltando para a tela de entrada...', 'success');
      window.setTimeout(async () => {
        await client.auth.signOut();
        clearCurrentUser();
        window.location.href = `login.html${destinationQuery}`;
      }, 700);
      return;
    }
    const email = normalizeEmail(recoveryForm.elements.email.value);
    if (!email) { setMessage(message, 'Informe o e-mail da conta.'); return; }
    setBusy(recoveryForm, true);
    const redirectTo = new URL(`recuperar-senha.html${destinationQuery}`, window.location.href).href;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(recoveryForm, false);
    if (error) { setMessage(message, error.message || 'Não foi possível enviar o link.'); return; }
    setMessage(message, 'Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.', 'success');
  });

  const profileForm = document.getElementById('demo-profile-form');
  const passwordForm = document.getElementById('demo-password-form');

  const hydrateProfile = user => {
    if (!profileForm || !user) return;
    profileForm.elements.name.value = displayName(user);
    profileForm.elements.email.value = user.email || '';
  };

  if (profileForm) profileForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = document.getElementById('profile-message');
    if (!profileForm.checkValidity()) { setMessage(message, 'Confira o nome e o e-mail.'); profileForm.reportValidity(); return; }
    setBusy(profileForm, true);
    const oldUser = readCurrentUser();
    const name = String(profileForm.elements.name.value || '').trim();
    const email = normalizeEmail(profileForm.elements.email.value);
    const { data, error } = await client.auth.updateUser({ email, data: { full_name: name } });
    setBusy(profileForm, false);
    if (error) { setMessage(message, error.message || 'Não foi possível atualizar o perfil.'); return; }
    const effective = data.user || { ...oldUser, email, user_metadata: { full_name: name } };
    const mirrored = mirrorUser(effective);
    const requests = safeJson('infotechDemoRequests', []);
    if (Array.isArray(requests)) {
      requests.forEach(request => {
        if (normalizeEmail(request.ownerEmail) === normalizeEmail(oldUser.email)) {
          request.ownerEmail = mirrored.email;
          request.ownerName = mirrored.name;
        }
      });
      try { localStorage.setItem('infotechDemoRequests', JSON.stringify(requests)); } catch {}
    }
    document.querySelectorAll('[data-demo-name]').forEach(el => { el.textContent = mirrored.name; });
    document.querySelectorAll('[data-demo-email]').forEach(el => { el.textContent = mirrored.email; });
    setMessage(message, email !== normalizeEmail(oldUser.email)
      ? 'Perfil atualizado. O Supabase pode pedir confirmação no novo e-mail.'
      : 'Perfil atualizado com sucesso.', 'success');
  });

  if (passwordForm) passwordForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = document.getElementById('password-message');
    const currentPassword = String(passwordForm.elements.currentPassword.value || '');
    const newPassword = String(passwordForm.elements.newPassword.value || '');
    const confirm = String(passwordForm.elements.confirmPassword.value || '');
    if (newPassword.length < 6 || newPassword !== confirm) {
      setMessage(message, newPassword !== confirm ? 'A confirmação não corresponde à nova senha.' : 'Use pelo menos 6 caracteres.');
      return;
    }
    const user = readCurrentUser();
    setBusy(passwordForm, true);
    const verify = await client.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verify.error) { setBusy(passwordForm, false); setMessage(message, 'A senha atual está incorreta.'); return; }
    const { data, error } = await client.auth.updateUser({ password: newPassword });
    setBusy(passwordForm, false);
    if (error) { setMessage(message, error.message || 'Não foi possível alterar a senha.'); return; }
    if (data.user) mirrorUser(data.user);
    passwordForm.reset();
    setMessage(message, 'Senha alterada com sucesso.', 'success');
  });

  const protectedPage = document.body.hasAttribute('data-client-protected');
  const currentPage = location.pathname.split('/').pop() || 'index.html';

  const redirectToLogin = () => {
    const target = currentPage || 'painel-cliente.html';
    const safeTarget = allowedDestinations.has(target) ? target : 'painel-cliente.html';
    window.location.replace(`login.html?destino=${encodeURIComponent(safeTarget)}`);
  };

  const renderNavigation = user => {
    const local = user ? mirrorUser(user) : {};
    document.querySelectorAll('[data-demo-name]').forEach(el => { el.textContent = local.name || 'Cliente'; });
    document.querySelectorAll('[data-demo-email]').forEach(el => { el.textContent = local.email || 'Não informado'; });

    const publicHeader = document.querySelector('.site-header .navbar');
    if (publicHeader && !document.querySelector('.account-nav')) {
      const makeIcon = path => `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${path}"></path></svg>`;
      const userIcon = makeIcon('M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14z');
      const chevronIcon = makeIcon('M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4z');
      const accountWrap = document.createElement('div');
      accountWrap.className = 'account-nav';
      if (local.email) {
        const firstName = local.name.split(/\s+/)[0];
        accountWrap.innerHTML = `<button class="account-trigger" type="button" aria-expanded="false" aria-haspopup="true"><span class="account-avatar">${userIcon}</span><span class="account-trigger-text"><small>Olá,</small><strong>${firstName}</strong></span><span class="account-chevron">${chevronIcon}</span></button><div class="account-dropdown" hidden><div class="account-summary"><strong>${local.name}</strong><span>${local.email}</span></div><a href="perfil.html">Meu Perfil</a><a href="painel-cliente.html">Minhas Solicitações</a><a href="nova-solicitacao.html">Nova Solicitação</a><button type="button" class="account-logout">Sair da conta</button></div>`;
        const trigger = accountWrap.querySelector('.account-trigger');
        const dropdown = accountWrap.querySelector('.account-dropdown');
        const close = () => { dropdown.hidden = true; trigger.setAttribute('aria-expanded', 'false'); accountWrap.classList.remove('open'); };
        trigger.addEventListener('click', e => { e.stopPropagation(); const opening = dropdown.hidden; dropdown.hidden = !opening; trigger.setAttribute('aria-expanded', String(opening)); accountWrap.classList.toggle('open', opening); });
        document.addEventListener('click', e => { if (!accountWrap.contains(e.target)) close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
        accountWrap.querySelector('.account-logout').addEventListener('click', async () => { await client.auth.signOut(); clearCurrentUser(); location.href = 'index.html'; });
      } else {
        accountWrap.innerHTML = `<a class="account-login-link" href="login.html">${userIcon}<span>Área do Cliente</span></a>`;
      }
      publicHeader.appendChild(accountWrap);
    }

    document.querySelectorAll('a[href^="login.html?destino="]').forEach(link => {
      if (!local.email) return;
      const linkParams = new URLSearchParams(link.getAttribute('href').split('?')[1] || '');
      const target = linkParams.get('destino');
      if (allowedDestinations.has(target)) link.href = target;
    });

    if (local.email && currentPage === 'index.html' && !document.querySelector('.home-account-welcome')) {
      const heroCopy = document.querySelector('.hero-copy');
      const heroActions = document.querySelector('.hero-actions');
      if (heroCopy && heroActions) {
        const greeting = document.createElement('div');
        greeting.className = 'home-account-welcome';
        greeting.innerHTML = `<p><strong>Olá, ${local.name.split(/\s+/)[0]}!</strong> Sua conta Supabase está conectada.</p>`;
        heroCopy.insertBefore(greeting, heroActions);
      }
    }
  };

  document.querySelectorAll('[data-demo-logout]').forEach(el => el.addEventListener('click', async event => {
    event.preventDefault();
    await client.auth.signOut();
    clearCurrentUser();
    location.href = el.getAttribute('href') || 'index.html';
  }));
  document.querySelectorAll('[data-preserve-destination]').forEach(link => {
    const base = link.getAttribute('href').split('?')[0];
    link.href = base + destinationQuery;
  });

  const initialize = async () => {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) console.warn('Falha ao restaurar sessão:', error.message);
    const user = session?.user || null;
    if (user) {
      const localAccount = readAccounts().find(a => a.id === user.id || normalizeEmail(a.email) === normalizeEmail(user.email));
      const onlineProfile = await getOnlineProfile(user.id);
      if (onlineProfile?.is_blocked || localAccount?.status === 'blocked') {
        await client.auth.signOut();
        clearCurrentUser();
        if (protectedPage) redirectToLogin(); else renderNavigation(null);
        return;
      }
      mirrorUser(user);
      hydrateProfile(user);
      renderNavigation(user);
    } else {
      clearCurrentUser();
      renderNavigation(null);
      if (protectedPage) redirectToLogin();
    }
    window.dispatchEvent(new CustomEvent('infotech:auth-ready', { detail: { user } }));
  };

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') applyRecoveryMode(true);
    if (session?.user) mirrorUser(session.user);
    if (event === 'SIGNED_OUT') clearCurrentUser();
  });

  initialize();
})();
