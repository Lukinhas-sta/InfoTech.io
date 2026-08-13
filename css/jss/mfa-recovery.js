(() => {
  'use strict';

  const page = location.pathname.split('/').pop() || '';
  if (page !== 'admin-seguranca.html') return;

  const db = window.infotechSupabase;
  if (!db?.auth?.mfa) return;

  const $ = s => document.querySelector(s);
  const status = $('#admin-mfa-status');
  const setup = $('#admin-mfa-setup');
  const enrollButton = $('#admin-mfa-enroll');
  const qr = $('#admin-mfa-qr');
  const secret = $('#admin-mfa-secret');
  const verifyForm = $('#admin-mfa-verify-form');
  const message = $('#admin-mfa-message');
  const continueLink = $('#admin-mfa-continue');
  const pendingKey = 'infotech-admin-mfa-pending-v9';

  const showMessage = (text, type = '') => {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`;
  };

  const safeDestination = raw => {
    const value = String(raw || '');
    return /^(painel-admin|admin-solicitacao|clientes-admin|cliente-admin)\.html(?:\?.*)?$/.test(value)
      ? value
      : 'painel-admin.html';
  };

  const destination = safeDestination(new URLSearchParams(location.search).get('destino'));

  function factorPool(data) {
    if (Array.isArray(data?.all)) return data.all;
    return [...(data?.totp || []), ...(data?.phone || [])];
  }

  async function readState() {
    const [{ data: factors, error: factorsError }, { data: aal, error: aalError }] = await Promise.all([
      db.auth.mfa.listFactors(),
      db.auth.mfa.getAuthenticatorAssuranceLevel()
    ]);
    if (factorsError) throw factorsError;
    if (aalError) throw aalError;
    const all = factorPool(factors);
    return {
      all,
      verified: all.filter(f => f?.status === 'verified'),
      unverified: all.filter(f => f?.status !== 'verified'),
      currentLevel: aal?.currentLevel || null
    };
  }

  function normalizeQrCode(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^data:image\//i.test(value) || /^https?:\/\//i.test(value)) return value;
    if (/^<svg[\s>]/i.test(value)) {
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(value)}`;
    }
    return '';
  }

  async function refreshUi() {
    try {
      const state = await readState();
      if (state.verified.length) {
        sessionStorage.removeItem(pendingKey);
        if (setup) setup.hidden = true;
        if (state.currentLevel === 'aal2') {
          if (status) status.textContent = 'MFA ativo · sessão verificada';
          if (verifyForm) verifyForm.hidden = true;
          if (continueLink) {
            continueLink.hidden = false;
            continueLink.href = destination;
          }
        } else {
          if (status) status.textContent = 'MFA ativo · digite o código do seu aplicativo autenticador';
          if (verifyForm) verifyForm.hidden = false;
        }
        return;
      }

      if (setup) setup.hidden = false;
      if (continueLink) continueLink.hidden = true;
      if (state.unverified.length) {
        if (status) status.textContent = 'A configuração anterior ficou incompleta. Gere um novo QR para continuar.';
        if (enrollButton) enrollButton.textContent = 'Gerar novo QR';
        if (verifyForm) verifyForm.hidden = true;
      } else {
        if (status) status.textContent = 'MFA ainda não configurado';
        if (enrollButton) enrollButton.textContent = 'Configurar autenticador';
      }
    } catch (error) {
      console.warn('MFA state:', error);
    }
  }

  async function removeIncompleteFactors() {
    const state = await readState();
    const incomplete = state.unverified.filter(f => f?.id);
    for (const factor of incomplete) {
      const { error } = await db.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
    }
  }

  async function startEnrollment(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!enrollButton) return;

    enrollButton.disabled = true;
    showMessage('Preparando um novo autenticador...', 'success');
    try {
      await removeIncompleteFactors();

      const friendlyName = `InfoTech Admin ${new Date().toISOString().slice(0, 10)} ${Date.now().toString().slice(-6)}`;
      const { data, error } = await db.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName
      });
      if (error) throw error;

      sessionStorage.setItem(pendingKey, data.id);
      const qrSource = normalizeQrCode(data?.totp?.qr_code);
      if (qr) {
        if (qrSource) {
          qr.src = qrSource;
          qr.hidden = false;
        } else {
          qr.removeAttribute('src');
          qr.hidden = true;
        }
      }
      if (secret) secret.textContent = data?.totp?.secret || '';
      if (setup) setup.hidden = false;
      if (verifyForm) verifyForm.hidden = false;
      if (status) status.textContent = 'QR novo gerado · escaneie no aplicativo autenticador';
      showMessage('O código de 6 dígitos vem do aplicativo autenticador, não do Gmail.', 'success');
      verifyForm?.elements?.code?.focus();
    } catch (error) {
      console.error('MFA enrollment:', error);
      showMessage(error?.message || 'Não foi possível gerar um novo autenticador. Tente novamente.', 'error');
    } finally {
      enrollButton.disabled = false;
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!verifyForm) return;

    const code = String(verifyForm.elements.code?.value || '').replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      showMessage('Digite os 6 números mostrados no aplicativo autenticador.', 'error');
      return;
    }

    verifyForm.querySelectorAll('input,button').forEach(el => { el.disabled = true; });
    showMessage('Confirmando segundo fator...', 'success');
    try {
      let factorId = sessionStorage.getItem(pendingKey) || '';
      const state = await readState();
      if (!factorId || !state.all.some(f => f?.id === factorId)) {
        factorId = state.unverified[0]?.id || state.verified[0]?.id || '';
      }
      if (!factorId) throw new Error('Nenhum autenticador disponível. Gere um novo QR.');

      const { error } = await db.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;

      sessionStorage.removeItem(pendingKey);
      if (status) status.textContent = 'MFA ativo · sessão verificada';
      showMessage('Segundo fator confirmado. Abrindo o painel...', 'success');
      setTimeout(() => location.replace(destination), 350);
    } catch (error) {
      console.error('MFA verify:', error);
      showMessage('Código inválido ou expirado. Confira o aplicativo autenticador e tente novamente.', 'error');
    } finally {
      verifyForm.querySelectorAll('input,button').forEach(el => { el.disabled = false; });
    }
  }

  enrollButton?.addEventListener('click', startEnrollment, true);
  verifyForm?.addEventListener('submit', verifyCode, true);
  qr?.addEventListener('error', () => {
    qr.hidden = true;
    showMessage('Se o QR não aparecer, use o segredo exibido abaixo no aplicativo autenticador.', 'error');
  });

  setTimeout(refreshUi, 250);
})();
