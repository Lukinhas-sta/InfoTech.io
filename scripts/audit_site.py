#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import re, sys, json
import xml.etree.ElementTree as ET
import tinycss2

ROOT=Path(__file__).resolve().parents[1]
errors=[]; warnings=[]
htmls=sorted(ROOT.glob('*.html'))
public_pages={'index.html','servicos.html','solicitacoes.html','projetos.html','contato.html','sobre.html','privacidade.html','seguranca.html'}
private_prefixes={'admin-login.html','admin-solicitacao.html','admin-seguranca.html','cliente-admin.html','clientes-admin.html','detalhes-solicitacao.html','email-confirmado.html','login.html','cadastro.html','nova-solicitacao.html','painel-admin.html','painel-cliente.html','perfil.html','recuperar-senha.html','solicitacao-enviada.html'}

def err(msg): errors.append(msg)
def warn(msg): warnings.append(msg)

for path in htmls:
    soup=BeautifulSoup(path.read_text(encoding='utf-8'),'html.parser')
    ids=[x.get('id') for x in soup.find_all(attrs={'id':True})]
    dup=sorted({x for x in ids if ids.count(x)>1})
    if dup: err(f'{path.name}: IDs duplicados: {dup}')
    csp=soup.head.find('meta',attrs={'http-equiv':'Content-Security-Policy'}) if soup.head else None
    if not csp:
        err(f'{path.name}: sem CSP meta')
    else:
        policy=csp.get('content','')
        if "style-src 'self'" not in policy: err(f'{path.name}: style-src CSP inesperado')
        if "'unsafe-inline'" in policy: err(f'{path.name}: CSP ainda permite unsafe-inline')
        if "object-src 'none'" not in policy: err(f'{path.name}: CSP sem object-src none')
        if "base-uri 'self'" not in policy: err(f'{path.name}: CSP sem base-uri self')
    if soup.find(attrs={'style':True}): err(f'{path.name}: atributo style inline encontrado')
    for el in soup.find_all(True):
        if any(str(k).lower().startswith('on') for k in el.attrs): err(f'{path.name}: event handler inline encontrado em <{el.name}>')
    robots=soup.head.find('meta',attrs={'name':'robots'}) if soup.head else None
    if path.name in private_prefixes and (not robots or 'noindex' not in robots.get('content','')): err(f'{path.name}: página privada sem noindex')
    if soup.html and soup.html.get('lang') != 'pt-BR': err(f'{path.name}: lang deve ser pt-BR')
    mains=soup.find_all('main')
    if len(mains)!=1: err(f'{path.name}: esperado exatamente 1 <main>, encontrado {len(mains)}')
    h1s=soup.find_all('h1')
    if len(h1s)!=1: warn(f'{path.name}: esperado 1 H1, encontrado {len(h1s)}')
    if path.name in public_pages:
        if not soup.head.find('link',attrs={'rel':'canonical'}): err(f'{path.name}: sem canonical')
        if not soup.head.find('meta',attrs={'name':'description'}): err(f'{path.name}: sem meta description')
        if not soup.head.find('meta',attrs={'property':'og:title'}): err(f'{path.name}: sem Open Graph')
    for img in soup.find_all('img'):
        if img.get('alt') is None: err(f'{path.name}: imagem sem alt: {img.get("src")}')
        if not img.get('width') or not img.get('height'): err(f'{path.name}: imagem sem width/height: {img.get("src")}')
    for field in soup.find_all(['input','select','textarea']):
        if field.get('type') in {'hidden','submit','button','reset'}: continue
        fid=field.get('id')
        labelled=bool(field.get('aria-label') or field.get('aria-labelledby') or (fid and soup.find('label',attrs={'for':fid})))
        if not labelled: err(f'{path.name}: campo sem label acessível: {fid or field.name}')
    for button in soup.find_all('button'):
        if not button.get('type'): err(f'{path.name}: button sem type explícito')
    for a in soup.find_all('a',href=True):
        href=a['href'].strip()
        if href.startswith(('http://','https://','mailto:','tel:','javascript:')):
            pass
        else:
            base, _, frag=href.partition('#')
            target=base.split('?',1)[0]
            target_path=path if not target else ROOT/target
            if target and not target_path.exists():
                err(f'{path.name}: link local quebrado -> {href}')
            elif frag and target_path.exists() and target_path.suffix.lower()=='.html':
                target_soup=BeautifulSoup(target_path.read_text(encoding='utf-8'),'html.parser')
                if not target_soup.find(id=frag): err(f'{path.name}: âncora inexistente -> {href}')
        if a.get('target')=='_blank':
            rel=set(a.get('rel') or [])
            if 'noopener' not in rel: err(f'{path.name}: target=_blank sem noopener -> {href}')
    for tag,attr in [('script','src'),('link','href'),('img','src')]:
        for el in soup.find_all(tag):
            ref=el.get(attr,'')
            if not ref or ref.startswith(('http://','https://','data:','blob:','#')): continue
            local=ref.split('?',1)[0].split('#',1)[0]
            if local and not (ROOT/local).exists(): err(f'{path.name}: recurso quebrado -> {ref}')

# Security smell checks in client code.
js='\n'.join(p.read_text(encoding='utf-8',errors='ignore') for p in (ROOT/'css/jss').glob('*.js'))
if re.search(r'sessionStorage\.setItem\([^\n]{0,200}password',js,re.I): err('Senha ainda parece ser salva em sessionStorage')
if re.search(r'localStorage\.setItem\([^\n]{0,200}password',js,re.I): err('Senha ainda parece ser salva em localStorage')
if re.search(r'service[_-]?role',js,re.I): err('Possível referência a service_role no JavaScript público')
if re.search(r'\beval\s*\(|new\s+Function\s*\(',js): err('eval/new Function encontrado')
if re.search(r'\bstyle\s*=|\.style\b|style=["\']',js,re.I): err('Estilo inline/dinâmico encontrado no JavaScript; incompatível com CSP estrita')

cfg=(ROOT/'css/jss/supabase-config.js').read_text(encoding='utf-8',errors='ignore')
if 'publishableKey' not in cfg: warn('Configuração não usa o nome publishableKey')

file_page=(ROOT/'detalhes-solicitacao.html').read_text(encoding='utf-8')
for risky in ['.zip','.doc','.docx','.exe']:
    if risky in file_page.lower(): err(f'Upload ainda aceita formato arriscado: {risky}')

required=['robots.txt','sitemap.xml','manifest.webmanifest','.well-known/security.txt','SUPABASE-HARDENING-V8.sql','SECURITY-HEADERS-V8.md']
for r in required:
    if not (ROOT/r).exists(): err(f'Arquivo obrigatório ausente: {r}')

# CSS, manifest e sitemap também precisam ser sintaticamente válidos.
css_path=ROOT/'css/v6.css'
if css_path.exists():
    css_rules=tinycss2.parse_stylesheet(css_path.read_text(encoding='utf-8'),skip_comments=False,skip_whitespace=False)
    css_errors=[r for r in css_rules if getattr(r,'type',None)=='error']
    if css_errors: err(f'CSS contém {len(css_errors)} erro(s) de parse')
try:
    json.loads((ROOT/'manifest.webmanifest').read_text(encoding='utf-8'))
except Exception as exc:
    err(f'manifest.webmanifest inválido: {exc}')
try:
    ET.parse(ROOT/'sitemap.xml')
except Exception as exc:
    err(f'sitemap.xml inválido: {exc}')

print(f'HTML analisados: {len(htmls)}')
for w in warnings: print('WARN:',w)
for e in errors: print('ERRO:',e)
if errors:
    print(f'FALHOU: {len(errors)} erro(s), {len(warnings)} aviso(s).')
    sys.exit(1)
print(f'OK: auditoria estática passou com {len(warnings)} aviso(s).')
