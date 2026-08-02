/* Infotech.io — Versão 4.6 | Melhorias progressivas e seguras */
(() => {
  'use strict';

  document.documentElement.classList.add('js-enabled');

  // Imagens carregam de forma mais leve sem alterar imagens já exibidas no topo.
  document.querySelectorAll('img').forEach((img, index) => {
    if (!img.hasAttribute('decoding')) img.decoding = 'async';
    if (index > 0 && !img.hasAttribute('loading')) img.loading = 'lazy';
  });

  // Permite fechar menus e caixas abertas com Escape.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const mobileButton = document.querySelector('.menu-mobile[aria-expanded="true"]');
    if (mobileButton) mobileButton.click();

    document.querySelectorAll('[aria-expanded="true"]').forEach((control) => {
      if (control !== mobileButton && typeof control.click === 'function') control.click();
    });
  });

  // Evita envio duplo acidental, sem bloquear formulários que falharem na validação.
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', () => {
      if (!form.checkValidity()) return;
      const submit = form.querySelector('button[type="submit"], input[type="submit"]');
      if (!submit || submit.dataset.keepEnabled === 'true') return;
      submit.dataset.originalText = submit.textContent;
      window.setTimeout(() => {
        if (submit.isConnected) submit.disabled = true;
      }, 0);
      window.setTimeout(() => {
        if (submit.isConnected) submit.disabled = false;
      }, 1200);
    });
  });
})();
