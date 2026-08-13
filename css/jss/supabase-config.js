// Chave publicável do projeto Supabase. Nunca use chave administrativa no navegador.
window.INFOTECH_SUPABASE_CONFIG = Object.freeze({
  url: 'https://rgngqumqzylthdiazvfu.supabase.co',
  publishableKey: 'sb_publishable_Nw2oaGdMQHVIJNhUpjv5ag_JcxmRu2w'
});

// Camada preventiva para as rotas administrativas.
// O banco continua sendo a autoridade final; esta camada garante que o painel
// encaminhe o administrador para configurar/validar MFA antes de continuar.
(() => {
  'use strict';

  const page = location.pathname.split('/').pop() || 'index.html';
  const adminPages = new Set([
    'admin-login.html',
    'admin-seguranca.html',
    'admin-solicitacao.html',
    'painel-admin.html',
    'clientes-admin.html',
    'cliente-admin.html'
  ]);
  if (!adminPages.has(page) || !window.supabase?.createClient) return;

  const cfg = window.INFOTECH_SUPABASE_CONFIG;
  const db = window.infotechSupabase || window.supabase.createClient(
    cfg.url,
    cfg.publishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'infotech-admin-auth-v8'
      }
    }
  );
  window.infotechSupabase = db;

  let checking = false;
  let lastUserId = '';

  const safeDestination = () => {
    const raw = `${page}${location.search || ''}`;
    return /^(painel-admin|admin-solicitacao|clientes-admin|cliente-admin)\.html(?:\?.*)?$/.test(raw)
      ? raw
      : 'painel-admin.html';
  };

  async function enforce(session) {
    if (checking || !session?.user) return;
    checking = true;
    try {
      const user = session.user;
      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('role,is_blocked')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || profile?.role !== 'admin' || profile?.is_blocked) return;

      const [{ data: factors, error: factorsError }, { data: aal, error: aalError }] = await Promise.all([
        db.auth.mfa.listFactors(),
        db.auth.mfa.getAuthenticatorAssuranceLevel()
      ]);
      if (factorsError || aalError) return;

      const pool = Array.isArray(factors?.all)
        ? factors.all
        : [...(factors?.totp || []), ...(factors?.phone || [])];
      const verified = pool.filter(f => f?.status === 'verified');
      const currentLevel = aal?.currentLevel || null;

      if (page === 'admin-seguranca.html') return;

      const dest = encodeURIComponent(safeDestination());
      if (!verified.length) {
        location.replace(`admin-seguranca.html?mode=setup&destino=${dest}`);
        return;
      }
      if (currentLevel !== 'aal2') {
        location.replace(`admin-seguranca.html?mode=challenge&destino=${dest}`);
      }
    } finally {
      checking = false;
    }
  }

  db.auth.getSession().then(({ data }) => enforce(data?.session)).catch(() => {});
  db.auth.onAuthStateChange((event, session) => {
    if (!['SIGNED_IN', 'TOKEN_REFRESHED', 'MFA_CHALLENGE_VERIFIED'].includes(event)) return;
    const id = session?.user?.id || '';
    if (event === 'TOKEN_REFRESHED' && id && id === lastUserId) return;
    lastUserId = id;
    queueMicrotask(() => enforce(session));
  });
})();
