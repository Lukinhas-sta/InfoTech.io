(() => {
  'use strict';
  // Dificulta clickjacking em hospedagens que não permitem configurar headers HTTP.
  if (window.top !== window.self) {
    try { window.top.location = window.self.location.href; }
    catch (_) { document.documentElement.innerHTML = ''; }
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[target="_blank"]').forEach(a => {
      const rel = new Set((a.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener'); rel.add('noreferrer');
      a.setAttribute('rel', [...rel].join(' '));
    });
  });
})();
