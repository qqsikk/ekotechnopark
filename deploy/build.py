# -*- coding: utf-8 -*-
"""Сборка сайта под TimeWeb в папку _deploy/site.

Запуск:  python deploy/build.py ДОМЕН        например  python deploy/build.py eco.ccg48.ru

Что делает:
  * копирует только файлы сайта (страницы, стили, скрипты, assets, .htaccess, 404);
  * вписывает домен туда, где нужен полный адрес: og:image и подпись в памятке;
  * добавляет к style.css, motion*.css и motion*.js хвост ?v=<хеш содержимого>,
    чтобы после правок браузеры не держали старые файлы из кэша;
  * создаёт robots.txt и sitemap.xml под этот домен;
  * проверяет, что каждый локальный путь из страниц и стилей существует в сборке
    с точным регистром — на хостинге Linux, и Photo.jpg с photo.jpg там разные файлы.
"""
import hashlib, os, re, shutil, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_deploy', 'site')
OLD_HOST = 'ekotechnopark.vercel.app'

PAGES = ['index.html', 'sorting.html', 'memo.html', 'glass-map.html', '404.html']
STATIC = ['style.css', 'motion.css', 'motion-max.css', 'motion.js', 'motion-max.js', '.htaccess']
DIRS = ['assets']
VERSIONED = ['style.css', 'motion.css', 'motion-max.css', 'motion.js', 'motion-max.js']
SITEMAP = ['', 'sorting.html', 'memo.html', 'glass-map.html']


def die(msg):
    sys.stderr.write('ОШИБКА: ' + msg + '\n')
    sys.exit(1)


def main():
    if len(sys.argv) != 2 or not re.match(r'^[a-z0-9.-]+\.[a-z0-9-]{2,}$', sys.argv[1].lower()):
        die('укажи домен без https:// и слешей, например: python deploy/build.py eco.ccg48.ru '
            '(кириллический домен — в punycode, xn--...)')
    domain = sys.argv[1].lower()
    base = 'https://' + domain + '/'

    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    for f in PAGES + STATIC:
        shutil.copy2(os.path.join(ROOT, f), os.path.join(OUT, f))
    for d in DIRS:
        shutil.copytree(os.path.join(ROOT, d), os.path.join(OUT, d))

    ver = {}
    for f in VERSIONED:
        ver[f] = hashlib.sha1(open(os.path.join(OUT, f), 'rb').read()).hexdigest()[:10]

    for f in PAGES:
        p = os.path.join(OUT, f)
        s = open(p, encoding='utf-8').read()
        s = s.replace('https://' + OLD_HOST + '/', base).replace(OLD_HOST, domain)
        for name, h in ver.items():
            s = re.sub(r'((?:href|src)="/?)' + re.escape(name) + '"', r'\g<1>' + name + '?v=' + h + '"', s)
        if domain != OLD_HOST and OLD_HOST in s:
            die('в %s остался %s' % (f, OLD_HOST))
        open(p, 'w', encoding='utf-8', newline='').write(s)

    open(os.path.join(OUT, 'robots.txt'), 'w', encoding='utf-8', newline='\n').write(
        'User-agent: *\nAllow: /\n\nSitemap: %ssitemap.xml\n' % base)
    today = datetime.date.today().isoformat()
    urls = ''.join('  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>\n' % (base, u, today) for u in SITEMAP)
    open(os.path.join(OUT, 'sitemap.xml'), 'w', encoding='utf-8', newline='\n').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '</urlset>\n')

    # --- проверка путей с точным регистром
    have = set()
    for dp, dn, fn in os.walk(OUT):
        for x in fn:
            have.add(os.path.relpath(os.path.join(dp, x), OUT).replace('\\', '/'))
    ref = re.compile(r'''(?:src|href|poster|data-src)\s*=\s*"([^"#?]+)|url\(\s*["']?([^"')?#]+)''')
    bad = []
    for f in PAGES + [x for x in STATIC if x.endswith('.css')]:
        s = open(os.path.join(OUT, f), encoding='utf-8').read()
        for m in ref.finditer(s):
            r = (m.group(1) or m.group(2)).strip()
            if re.match(r'^(https?:|mailto:|tel:|data:|#|$)', r) or r.endswith('/'):
                continue
            r = r.lstrip('/')
            if r and r not in have:
                bad.append('%s → %s' % (f, r))
    # кадры бутылки собираются в скрипте: assets/seq/<фаза>/001.webp и дальше
    idx = open(os.path.join(OUT, 'index.html'), encoding='utf-8').read()
    for attr_n, attr_dir in (('data-cap-frames', 'data-cap-seq'), ('data-pour-frames', 'data-pour-seq'), ('data-frames', 'data-seq')):
        n = int(re.search(attr_n + r'="(\d+)"', idx).group(1))
        d = re.search(attr_dir + r'="([^"]+)"', idx).group(1)
        for i in range(1, n + 1):
            if '%s%03d.webp' % (d, i) not in have:
                bad.append('кадр %s%03d.webp' % (d, i))
    for cat in re.findall(r'data-cat="([a-z]+)"', idx):
        if 'assets/cutouts/cat-%s.webp' % cat not in have:
            bad.append('картинка ответа cat-%s.webp' % cat)
    if bad:
        die('нет файлов:\n  ' + '\n  '.join(bad))

    size = sum(os.path.getsize(os.path.join(OUT, x)) for x in have)
    print('Сборка готова: %s' % OUT)
    print('  домен: %s, файлов: %d, %.1f МБ' % (domain, len(have), size / 1048576))
    print('  версии: ' + ', '.join('%s?v=%s' % kv for kv in ver.items()))


if __name__ == '__main__':
    main()
