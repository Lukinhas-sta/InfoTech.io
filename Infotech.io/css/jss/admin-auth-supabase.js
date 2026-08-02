(() => {
  'use strict';

  const ADMIN_LOGIN_PAGE = 'admin-login.html';
  const ADMIN_HOME_PAGE = 'painel-admin.html';
  const adminPages = new Set([
    'painel-admin.html',
    'admin-solicitacao.html',
    'clientes-admin.html',
    'cliente-admin.html'
  ]);

  const pageName = location.pathname.split('/').pop() || 'index.html';
  const isAdminPage = adminPages.has(pageName);
  const isAdminLogin = pageName === ADMIN_LOGIN_PAGE;
  const message = document.getElementById('admin-login-message');
  const form = document.getElementById('supabase-admin-login');

  const setMessage = (text, type = 'error') => {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`;
  };

  const setBusy = busy => {
    if (!form) return;
    form.querySelectorAll('input, button').forEach(element => {
      element.disabled = busy;
    });
    form.setAttribute('aria-busy', String(busy));
  };


  document.querySelectorAll('[data-toggle-password]').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;
      const shouldShow = input.type === 'password';
      input.type = shouldShow ? 'text' : 'password';
      button.textContent = shouldShow ? 'Ocultar' : 'Mostrar';
      button.setAttribute('aria-label', shouldShow ? 'Ocultar senha' : 'Mostrar senha');
    });
  });

  const config = window.INFOTECH_SUPABASE_CONFIG || {};
  if (!config.url || !config.publishableKey || !window.supabase?.createClient) {
    setMessage('Não foi possível carregar a conexão segura. Atualize a página.');
    return;
  }

  const client = window.infotechSupabase || window.supabase.createClient(
    config.url,
    config.publishableKey,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  window.infotechSupabase = client;

  const clearLegacyAdmin = () => {
    try { sessionStorage.removeItem('infotechDemoAdmin'); } catch {}
  };

  const getRole = async userId => {
    const { data, error } = await client
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.role || 'client';
  };

  const verifyAdmin = async () => {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session?.user) return false;

    const role = await getRole(session.user.id);
    return role === 'admin';
  };

  const redirectToAdminLogin = () => {
    const destination = encodeURIComponent(pageName + location.search + location.hash);
    location.replace(`${ADMIN_LOGIN_PAGE}?destino=${destination}`);
  };

  if (isAdminPage) {
    document.documentElement.classList.add('admin-auth-checking');
    verifyAdmin()
      .then(isAdmin => {
        if (!isAdmin) {
          clearLegacyAdmin();
          redirectToAdminLogin();
          return;
        }
        try { sessionStorage.setItem('infotechDemoAdmin', 'true'); } catch {}
        document.documentElement.classList.remove('admin-auth-checking');
        document.documentElement.classList.add('admin-auth-ok');
      })
      .catch(error => {
        console.error('Falha ao validar administrador:', error);
        clearLegacyAdmin();
        redirectToAdminLogin();
      });
  }

  if (isAdminLogin) {
    verifyAdmin().then(isAdmin => {
      if (isAdmin) location.replace(ADMIN_HOME_PAGE);
    }).catch(() => {});

    form?.addEventListener('submit', async event => {
      event.preventDefault();

      if (!form.checkValidity()) {
        setMessage('Preencha seu e-mail e sua senha.');
        form.reportValidity();
        return;
      }

      const email = String(form.elements.email.value || '').trim().toLowerCase();
      const password = String(form.elements.password.value || '');

      setBusy(true);
      setMessage('Verificando sua conta administrativa...', 'success');

      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          setMessage('E-mail ou senha incorretos.');
          return;
        }

        const role = await getRole(data.user.id);
        if (role !== 'admin') {
          await client.auth.signOut();
          clearLegacyAdmin();
          setMessage('Esta conta não possui permissão administrativa.');
          return;
        }

        try { sessionStorage.setItem('infotechDemoAdmin', 'true'); } catch {}
        setMessage('Acesso autorizado. Abrindo o painel...', 'success');

        const params = new URLSearchParams(location.search);
        const requested = params.get('destino');
        const safeDestination = requested && [...adminPages].some(page => requested.startsWith(page))
          ? requested
          : ADMIN_HOME_PAGE;

        setTimeout(() => location.replace(safeDestination), 250);
      } catch (error) {
        console.error(error);
        setMessage('Não foi possível validar o acesso agora. Tente novamente.');
      } finally {
        setBusy(false);
      }
    });
  }

  document.querySelectorAll('[data-admin-logout]').forEach(link => {
    link.addEventListener('click', async event => {
      event.preventDefault();
      clearLegacyAdmin();
      await client.auth.signOut();
      location.replace(ADMIN_LOGIN_PAGE);
    });
  });
})();
