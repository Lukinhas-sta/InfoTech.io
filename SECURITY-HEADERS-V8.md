# Headers recomendados para produção — InfoTech.io V8

A V8 já inclui uma CSP compatível via `<meta>` como camada de defesa para hospedagem estática. Para proteção completa, configure também **headers HTTP reais** no provedor de hospedagem/reverse proxy.

```text
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; img-src 'self' data: blob: https://rgngqumqzylthdiazvfu.supabase.co; connect-src 'self' https://rgngqumqzylthdiazvfu.supabase.co wss://rgngqumqzylthdiazvfu.supabase.co; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; manifest-src 'self'; worker-src 'self' blob:; upgrade-insecure-requests
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
X-Frame-Options: DENY
```

## Atenção ao GitHub Pages

GitHub Pages não permite controlar todos esses headers por arquivo do projeto. Para a Área do Cliente e o painel administrativo, use uma hospedagem/reverse proxy que permita headers HTTP e autenticação apropriada. O site público pode continuar estático.

Antes de ativar HSTS com `preload`, confirme que **todos** os subdomínios funcionam exclusivamente em HTTPS.
