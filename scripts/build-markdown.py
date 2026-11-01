#!/usr/bin/env python3
"""Build Markdown twins of every public HTML page into md/.

AI agents that send `Accept: text/markdown` (see .htaccess) get md/<page>.md
instead of the full HTML, which is cheaper to read than markup, scripts and
footers. Pages also advertise their twin with <link rel="alternate"
type="text/markdown">. Run: python3 scripts/build-markdown.py
"""
import re, glob, os, html
from bs4 import BeautifulSoup, NavigableString

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://cryptobolt.io'
SKIP = {'404.html', 'account.html', 'app.html', 'trade.html'}  # private / app UIs
DROP = ['script', 'style', 'noscript', 'svg', 'form', 'button', 'nav', 'footer', 'header', 'iframe', 'template', 'select', 'input', 'textarea']

def clean(t):
    return re.sub(r'[ \t\r\f\v]+', ' ', t.replace('\xa0', ' ')).strip()

def inline(node):
    out = []
    for c in node.children:
        if isinstance(c, NavigableString):
            out.append(re.sub(r'\s+', ' ', str(c)))
        elif c.name == 'a':
            txt = clean(inline(c))
            href = c.get('href', '')
            if href.startswith('/'): href = SITE + href
            elif href and not re.match(r'^(https?:|mailto:|#)', href): href = f'{SITE}/{href}'
            out.append(f'[{txt}]({href})' if txt and href and not href.startswith('#') else txt)
        elif c.name in ('strong', 'b'):
            t = clean(inline(c)); out.append(f'**{t}**' if t else '')
        elif c.name in ('em', 'i'):
            t = clean(inline(c)); out.append(f'*{t}*' if t else '')
        elif c.name == 'code': out.append(f'`{clean(c.get_text())}`')
        elif c.name == 'br': out.append('\n')
        else: out.append(inline(c))
    return ''.join(out)

def block(node, lines, depth=0):
    for c in node.children:
        if isinstance(c, NavigableString): continue
        n = c.name
        if n in ('h1','h2','h3','h4','h5','h6'):
            t = clean(inline(c))
            if t: lines += ['', '#' * int(n[1]) + ' ' + t, '']
        elif n == 'p':
            t = clean(inline(c))
            if t: lines += ['', t, '']
        elif n in ('ul', 'ol'):
            lines.append('')
            for i, li in enumerate(c.find_all('li', recursive=False), 1):
                sub = [x for x in li.find_all(['ul','ol'], recursive=False)]
                for s in sub: s.extract()
                t = clean(inline(li))
                if t: lines.append(('  ' * depth) + (f'{i}. ' if n == 'ol' else '- ') + t)
                for s in sub: block(BeautifulSoup(str(s), 'html.parser'), lines, depth + 1)
            lines.append('')
        elif n == 'pre':
            lines += ['', '```', c.get_text().strip('\n'), '```', '']
        elif n == 'blockquote':
            t = clean(inline(c))
            if t: lines += ['', '> ' + t, '']
        elif n == 'table':
            rows = [[clean(inline(x)).replace('|', '\\|') for x in tr.find_all(['th', 'td'])] for tr in c.find_all('tr')]
            rows = [r for r in rows if any(r)]
            if rows:
                w = max(len(r) for r in rows)
                rows = [r + [''] * (w - len(r)) for r in rows]
                lines += ['', '| ' + ' | '.join(rows[0]) + ' |', '|' + ' --- |' * w]
                lines += ['| ' + ' | '.join(r) + ' |' for r in rows[1:]] + ['']
        elif n in ('div','section','article','main','aside','details','summary','figure','dl','dt','dd','address'):
            if n in ('dt','dd','summary') :
                t = clean(inline(c))
                if t: lines += ['', t, '']
            else:
                block(c, lines, depth)
        elif n == 'li': pass
        elif n == 'a':
            href = c.get('href', '')
            if c.find(['h1','h2','h3','h4','p','ul','div']):
                heading = c.find(['h1','h2','h3','h4'])
                block(c, lines, depth)
                if href and not href.startswith('#'):
                    full = SITE + href if href.startswith('/') else (href if re.match(r'^(https?:|mailto:)', href) else f'{SITE}/{href}')
                    lines += ['', f'Link: {full}', '']
            else:
                t = clean(inline(BeautifulSoup(f'<p>{c}</p>', 'html.parser').p))
                if t: lines += ['', t, '']
        else:
            t = clean(inline(c))
            if t and n in ('span', 'small', 'label'): lines += ['', t, '']

def convert(path):
    name = os.path.basename(path)
    soup = BeautifulSoup(open(path, encoding='utf-8').read(), 'html.parser')
    title = clean(soup.title.get_text()) if soup.title else name
    md = soup.find('meta', attrs={'name': 'description'})
    desc = clean(md['content']) if md and md.get('content') else ''
    canon = soup.find('link', rel='canonical')
    url = canon['href'] if canon else f'{SITE}/{name}'
    root = soup.find('main') or soup.body
    for t in root.find_all(DROP): t.decompose()
    lines = []
    block(root, lines)
    body = re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()
    # collapse exact duplicate consecutive blocks
    parts, last = [], None
    for p in body.split('\n\n'):
        if p != last: parts.append(p)
        last = p
    body = '\n\n'.join(parts)
    head = f'# {title}\n\n' + (f'> {desc}\n\n' if desc else '') + f'Source: {url}\n\n'
    tail = '\n\n---\nCryptoBolt is a market-data and education tool, not an exchange and not financial advice. Contact: info@cryptobolt.io\n'
    return head + body + tail

def main():
    out = os.path.join(ROOT, 'md'); os.makedirs(out, exist_ok=True)
    for f in glob.glob(os.path.join(out, '*.md')): os.remove(f)
    n = 0
    for p in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
        name = os.path.basename(p)
        if name in SKIP: continue
        open(os.path.join(out, name[:-5] + '.md'), 'w', encoding='utf-8', newline='\n').write(convert(p))
        n += 1
    print(f'wrote {n} markdown pages to md/')

if __name__ == '__main__':
    main()