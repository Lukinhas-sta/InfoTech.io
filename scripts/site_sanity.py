#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
errors = []


def fail(message: str) -> None:
    errors.append(message)


def local_path(raw: str, source: Path):
    value = (raw or '').strip()
    if not value or value.startswith(('#', 'data:', 'blob:', 'mailto:', 'tel:', 'javascript:')):
        return None
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc:
        return None
    path = unquote(parsed.path)
    if not path:
        return None
    if path.startswith('/'):
        return ROOT / path.lstrip('/')
    return source.parent / path


class PageParser(HTMLParser):
    def __init__(self, source: Path):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.ids = set()
        self.duplicate_ids = set()
        self.has_csp = False
        self.csp = ''
        self.has_noindex = False
        self.resources = []

    def handle_starttag(self, tag, attrs):
        data = {k.lower(): (v or '') for k, v in attrs}
        element_id = data.get('id')
        if element_id:
            if element_id in self.ids:
                self.duplicate_ids.add(element_id)
            self.ids.add(element_id)

        if tag.lower() == 'meta':
            if data.get('http-equiv', '').lower() == 'content-security-policy':
                self.has_csp = True
                self.csp = data.get('content', '')
            if data.get('name', '').lower() == 'robots' and 'noindex' in data.get('content', '').lower():
                self.has_noindex = True

        resource_attr = None
        if tag.lower() in {'script', 'img', 'source'}:
            resource_attr = 'src'
        elif tag.lower() == 'link':
            resource_attr = 'href'

        if resource_attr and data.get(resource_attr):
            self.resources.append(data[resource_attr])


private_pages = {
    'admin-login.html', 'admin-seguranca.html', 'admin-solicitacao.html',
    'painel-admin.html', 'cliente-admin.html', 'clientes-admin.html',
    'painel-cliente.html', 'detalhes-solicitacao.html', 'perfil.html',
    'nova-solicitacao.html', 'recuperar-senha.html', 'login.html', 'cadastro.html',
}

for page in sorted(ROOT.glob('*.html')):
    parser = PageParser(page)
    try:
        parser.feed(page.read_text(encoding='utf-8'))
    except Exception as exc:
        fail(f'{page.name}: HTML não pôde ser analisado: {exc}')
        continue

    if parser.duplicate_ids:
        fail(f'{page.name}: IDs duplicados: {sorted(parser.duplicate_ids)}')
    if not parser.has_csp:
        fail(f'{page.name}: CSP ausente')
    elif "'unsafe-inline'" in parser.csp:
        fail(f'{page.name}: CSP permite unsafe-inline')
    if page.name in private_pages and not parser.has_noindex:
        fail(f'{page.name}: página privada sem noindex')

    for ref in parser.resources:
        target = local_path(ref, page)
        if target is not None and not target.exists():
            fail(f'{page.name}: recurso local inexistente -> {ref}')

try:
    json.loads((ROOT / 'manifest.webmanifest').read_text(encoding='utf-8'))
except Exception as exc:
    fail(f'manifest.webmanifest inválido: {exc}')

try:
    ET.parse(ROOT / 'sitemap.xml')
except Exception as exc:
    fail(f'sitemap.xml inválido: {exc}')

robots = (ROOT / 'robots.txt').read_text(encoding='utf-8', errors='replace')
if 'Sitemap: https://infotech-io.com.br/sitemap.xml' not in robots:
    fail('robots.txt não aponta para o sitemap oficial')

if errors:
    for error in errors:
        print(f'ERRO: {error}')
    print(f'FALHOU: {len(errors)} problema(s).')
    sys.exit(1)

print(f'OK: {len(list(ROOT.glob("*.html")))} páginas verificadas sem referências locais quebradas.')
