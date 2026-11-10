/* motion-max.js — ветка motion-max. Полный моушн поверх motion.js.
   Требует GSAP 3 + ScrollTrigger (cdnjs); без них страница работает как на ветке motion.
   Что здесь: ленивые видео, прогресс скролла, интро, параллакс и магнитные кнопки в hero,
   покадровая сцена «Сомни бутылку», плавающие круги, 3D-наклон карточек, автопрокрутка
   ленты, текст по словам, конвейер из точек, кольца показателей, частицы партнёрства,
   плавный FAQ, круговое раскрытие карты, дыхание Техногрунта, курсор-кольцо, всплески в квизе. */
(function () {
  'use strict';
  var doc = document, html = doc.documentElement, body = doc.body;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  var C = { teal: '#41A89E', green: '#25605C', dark: '#104A47', orange: '#EE701E', mint: '#9FD3CC' };
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }

  // ---- 0. Видео подключаем лениво на всех экранах, вне видимости ставим на паузу
  $$('video[data-src]').forEach(function (v) {
    if (reduce) return;
    var started = false, onScreen = false;
    function syncPlayback() {
      if (!started || !onScreen || doc.hidden) { v.pause(); return; }
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    function load() {
      if (started) return;
      started = true;
      v.src = v.dataset.src;
      v.load();
      syncPlayback();
    }
    v.addEventListener('playing', function () { v.classList.add('is-ready'); }, { once: true });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { load(); io.disconnect(); } }, { rootMargin: '240px' });
      io.observe(v);
      new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; syncPlayback(); }).observe(v);
    } else { onScreen = true; load(); }
    doc.addEventListener('visibilitychange', syncPlayback);
  });

  // ---- 1. Прогресс скролла
  var bar = $('.scroll-progress');
  if (bar && hasGsap) gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // ---- 2. Интро: html.intro выставляет инлайн-скрипт в head (раз за сессию)
  var intro = $('#intro');
  function endIntro() { html.classList.remove('intro'); if (intro && intro.parentNode) intro.parentNode.removeChild(intro); }
  if (intro && html.classList.contains('intro')) {
    try { sessionStorage.setItem('ssg-intro', '1'); } catch (e) {}
    if (!hasGsap || reduce) endIntro();
    else {
      var words = $$('.intro-words span');
      gsap.set(intro, { clipPath: 'circle(150% at 13% 100%)' });
      gsap.timeline({ onComplete: endIntro })
        .to(words, { opacity: 1, y: 0, duration: 0.55, stagger: 0.14, ease: 'power3.out' }, 0.15)
        .to(words, { opacity: 0, y: -16, duration: 0.3, stagger: 0.05, ease: 'power2.in' }, 1.45)
        .to(intro, { clipPath: 'circle(0% at 13% 100%)', duration: 0.8, ease: 'power3.inOut' }, 1.6);
    }
  } else if (intro) endIntro();

  // ---- 3. Hero: параллакс слоёв от мыши, магнитные кнопки
  var hero = $('.hero');
  if (hero && hasGsap && fine && !reduce) {
    var layers = [[$('.hero-circle'), 16], [$('.hero-ring'), 26], [$('.hero .container'), 9], [$('.hero-video'), -12], [$('.hero-photo'), -12]];
    var setters = [];
    layers.forEach(function (l) {
      if (!l[0]) return;
      setters.push({ k: l[1], x: gsap.quickTo(l[0], 'x', { duration: 0.9, ease: 'power3.out' }), y: gsap.quickTo(l[0], 'y', { duration: 0.9, ease: 'power3.out' }) });
    });
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = hero.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      setters.forEach(function (s) { s.x(dx * s.k); s.y(dy * s.k); });
    });
    hero.addEventListener('pointerleave', function () { setters.forEach(function (s) { s.x(0); s.y(0); }); });
    $$('.hero-actions .btn').forEach(function (b) {
      var bx = gsap.quickTo(b, 'x', { duration: 0.4, ease: 'power3.out' }), by = gsap.quickTo(b, 'y', { duration: 0.4, ease: 'power3.out' });
      b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(); bx((e.clientX - r.left - r.width / 2) * 0.22); by((e.clientY - r.top - r.height / 2) * 0.32); });
      b.addEventListener('pointerleave', function () { bx(0); by(0); });
    });
  }

  // ---- 4. Сомни бутылку: две покадровые сцены подряд, прогресс от скролла.
  // Фаза 1 — крышка откручивается и улетает (assets/seq/cap/), фаза 2 — бутылка сминается (assets/seq/bottle/).
  var crush = $('#crush');
  if (crush) {
    var canvas = $('#crushCanvas'), ctx = canvas.getContext('2d');
    function share(name, fallback) { var v = parseFloat(crush.dataset[name]); return isNaN(v) ? fallback : Math.min(0.95, Math.max(0, v)); }
    var CAP = share('capShare', 0), POUR = Math.max(CAP, share('pourShare', CAP));
    var seqs = [
      { base: crush.dataset.capSeq || 'assets/seq/cap/', n: parseInt(crush.dataset.capFrames, 10) || 0, from: 0, to: CAP, label: 'откручено на', hint: 'Крути, чтобы открутить крышку' },
      { base: crush.dataset.pourSeq || 'assets/seq/pour/', n: parseInt(crush.dataset.pourFrames, 10) || 0, from: CAP, to: POUR, label: 'вылито на', hint: 'Крути дальше, чтобы вылить остатки' },
      { base: crush.dataset.seq || 'assets/seq/bottle/', n: parseInt(crush.dataset.frames, 10) || 63, from: POUR, to: 1, label: 'смято на', hint: 'Крути дальше, бутылка сминается' }
    ].filter(function (s) { return s.n > 0 && s.to > s.from; });
    seqs[0].from = 0; seqs[seqs.length - 1].to = 1;
    seqs.forEach(function (s) { s.frames = new Array(s.n); });
    var shown = null, wanted = null;
    function ready(s, i) { var im = s.frames[i]; return !!(im && im.complete && im.naturalWidth); }
    function draw(s, i) {
      if (!ready(s, i) || (shown && shown.s === s && shown.i === i)) return;
      shown = { s: s, i: i };
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(s.frames[i], 0, 0, canvas.width, canvas.height);
    }
    function load(s, i, done) {
      var im = new Image();
      im.decoding = 'async';
      if ('fetchPriority' in im) im.fetchPriority = 'low';
      im.onload = function () { if (!shown || (wanted && wanted.s === s && wanted.i === i)) draw(s, i); if (done) done(); };
      im.onerror = function () { if (done) done(); };
      im.src = s.base + ('00' + (i + 1)).slice(-3) + '.webp';
      s.frames[i] = im;
    }
    // Первый кадр каждой фазы — сразу. Остальные — после загрузки страницы и по четыре
    // за раз: раньше все 148 кадров уходили в сеть разом и задерживали картинки на экране.
    seqs.forEach(function (s) { load(s, 0); });
    var queue = [];
    seqs.forEach(function (s) { for (var i = 1; i < s.n; i++) queue.push([s, i]); });
    function pump() {
      var job = queue.shift();
      if (!job) return;
      if (job[0].frames[job[1]]) { pump(); return; }
      load(job[0], job[1], pump);
    }
    function startQueue() { for (var k = 0; k < 4; k++) pump(); }
    if (doc.readyState === 'complete') setTimeout(startQueue, 200);
    else window.addEventListener('load', function () { setTimeout(startQueue, 200); });
    var steps = $$('.crush-step', crush), ring = $('.crush-ring .fill', crush), badge = $('#crushBadge b'), badgeLabel = $('#crushBadgeLabel'), hint = $('.crush-hint span', crush), RING = 301.6;
    function setProgress(p) {
      p = Math.max(0, Math.min(1, p));
      var s = seqs[seqs.length - 1];
      for (var k = 0; k < seqs.length - 1; k++) { if (p < seqs[k].to) { s = seqs[k]; break; } }
      var local = Math.max(0, Math.min(1, (p - s.from) / (s.to - s.from))), i = Math.round(local * (s.n - 1));
      wanted = { s: s, i: i };
      if (ready(s, i)) draw(s, i);
      else { for (var j = i; j >= 0; j--) { if (ready(s, j)) { draw(s, j); break; } } }
      if (ring) ring.style.strokeDashoffset = RING * (1 - p);
      if (badge) badge.textContent = Math.round(local * 100) + '%';
      if (badgeLabel) badgeLabel.textContent = s.label;
      if (hint) hint.textContent = s.hint;
      steps.forEach(function (st, n) {
        var at = parseFloat(st.dataset.at), next = steps[n + 1] ? parseFloat(steps[n + 1].dataset.at) : 1.01;
        st.classList.toggle('is-on', p >= at && p < next);
        st.classList.toggle('is-done', p >= next);
      });
      crush.classList.toggle('is-complete', p >= 0.985);
    }
    setProgress(0);
    if (hasGsap) {
      ScrollTrigger.create({ trigger: crush, start: 'top top', end: '+=300%', pin: true, scrub: 0.4, anticipatePin: 1, onUpdate: function (self) { setProgress(self.progress); } });
    } else {
      window.addEventListener('scroll', function () {
        var r = crush.getBoundingClientRect();
        setProgress(Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - window.innerHeight))));
      }, { passive: true });
    }
  }

  // ---- 5. Плавающие круги на фонах секций
  if (hasGsap && !reduce) {
    var cols = ['rgba(65,168,158,.14)', 'rgba(37,96,92,.10)', 'rgba(65,168,158,.09)', 'rgba(238,112,30,.10)', 'rgba(16,74,71,.08)'];
    $$('.section.alt, .section.tint, .cta-band, .crush').forEach(function (sec, si) {
      sec.classList.add('has-orbs');
      var wrap = doc.createElement('div');
      wrap.className = 'orbs';
      wrap.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 5; i++) {
        var o = doc.createElement('span'), size = 120 + Math.random() * 240;
        o.className = 'orb';
        o.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;background:' + cols[(i + si) % cols.length];
        wrap.appendChild(o);
        gsap.to(o, { x: (Math.random() - 0.5) * 140, y: (Math.random() - 0.5) * 120, duration: 7 + Math.random() * 6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: -Math.random() * 6 });
      }
      sec.insertBefore(wrap, sec.firstChild);
    });
  }

  // ---- 6. Карточки: 3D-наклон за курсором
  if (hasGsap && fine && !reduce) {
    $$('.habit, .fraction, a.card, .rule-card, .figure, .crush-step, .partner-card').forEach(function (el) {
      el.classList.add('tilt');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(el, { rotationY: px * 10, rotationX: -py * 10, transformPerspective: 900, duration: 0.5, ease: 'power2.out' });
      });
      el.addEventListener('pointerleave', function () { gsap.to(el, { rotationX: 0, rotationY: 0, duration: 0.6, ease: 'power3.out' }); });
    });
  }

  // ---- 7. Лента привычек едет сама, останавливается при касании
  var strip = $('#habitStrip');
  if (strip && !reduce) {
    var dir = 1, paused = false, timer = null, rafId = null, pos = null;
    function pauseStrip(ms) {
      paused = true;
      strip.classList.remove('auto');
      clearTimeout(timer);
      if (ms < 1e8) timer = setTimeout(function () { paused = false; pos = null; strip.classList.add('auto'); }, ms);
    }
    strip.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') pauseStrip(1e9); });
    strip.addEventListener('pointerleave', function () { pauseStrip(1200); });
    ['pointerdown', 'touchstart', 'wheel', 'focusin'].forEach(function (ev) { strip.addEventListener(ev, function () { pauseStrip(3000); }, { passive: true }); });
    $$('.strip-controls button').forEach(function (b) { b.addEventListener('click', function () { pauseStrip(4000); }); });
    function tick() {
      if (!paused && doc.visibilityState === 'visible') {
        var max = strip.scrollWidth - strip.clientWidth;
        if (max > 0) {
          if (pos === null) pos = strip.scrollLeft;
          pos += 0.6 * dir;
          if (pos >= max) { pos = max; dir = -1; } else if (pos <= 0) { pos = 0; dir = 1; }
          strip.scrollLeft = pos;
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { if (!rafId) { strip.classList.add('auto'); pos = null; tick(); } }
        else if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      }).observe(strip);
    }
  }

  // ---- 8. Кто мы: заголовок и первый абзац входят по словам
  if (hasGsap && !reduce) {
    $$('.about h2, .about .reveal > p:not(.muted-dark)').forEach(function (el) {
      el.innerHTML = el.textContent.split(' ').map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
      gsap.from($$('.w', el), { opacity: 0, y: 14, stagger: 0.028, duration: 0.6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 82%' } });
    });
  }

  // ---- 9. Путь пакета: конвейер из точек по линии, медленный наезд на фото
  var track = $('.process-track'), proc = $('.process');
  if (track && proc && hasGsap && !reduce) {
    var dots = [], mq = window.matchMedia('(max-width: 900px)'), tweens = [], convActive = false, builtLen = -1, builtVert = null;
    for (var d = 0; d < 7; d++) { var el = doc.createElement('span'); el.className = 'conveyor-dot'; track.appendChild(el); dots.push(el); }
    function buildConveyor() {
      var vert = mq.matches, len = vert ? track.offsetHeight : track.offsetWidth;
      // дорожка та же — пересобирать нечего (так Safari прячет адресную строку)
      if (len === builtLen && vert === builtVert) return;
      builtLen = len; builtVert = vert;
      tweens.forEach(function (t) { t.kill(); });
      tweens = [];
      dots.forEach(function (el, i) {
        gsap.set(el, { x: 0, y: 0 });
        var to = vert ? { y: len } : { x: len };
        to.duration = 7; to.ease = 'none'; to.repeat = -1;
        var t = gsap.to(el, to).progress(i / dots.length);
        if (!convActive) t.pause();
        tweens.push(t);
      });
    }
    buildConveyor();
    ScrollTrigger.create({ trigger: proc, start: 'top 92%', end: 'bottom 8%', onToggle: function (self) { convActive = self.isActive; tweens.forEach(function (t) { self.isActive ? t.play() : t.pause(); }); } });
    window.addEventListener('resize', function () { setTimeout(buildConveyor, 50); });
    // дорожку мерили до загрузки шрифтов: на телефоне точки не доезжали до последнего шага
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { setTimeout(buildConveyor, 80); });
    window.addEventListener('load', function () { setTimeout(buildConveyor, 80); });
    $$('.pstep .circle img').forEach(function (im, i) { gsap.to(im, { scale: 1.08, duration: 9, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: -i * 2 }); });
  }

  // ---- 10. Показатели: кольцо-прогресс вокруг диска, диски чуть парят
  if (hasGsap) {
    $$('.figure .disc').forEach(function (disc, i) {
      var NS = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(NS, 'svg'), c = doc.createElementNS(NS, 'circle');
      svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', 'ring'); svg.setAttribute('aria-hidden', 'true');
      c.setAttribute('cx', '50'); c.setAttribute('cy', '50'); c.setAttribute('r', '48.5'); c.setAttribute('stroke-dasharray', '304.7'); c.setAttribute('stroke-dashoffset', '304.7');
      svg.appendChild(c); disc.appendChild(svg);
      gsap.to(c, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: disc, start: 'top 92%', end: 'top 45%', scrub: true } });
      if (!reduce) gsap.to(disc, { y: -8, duration: 3 + i * 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    });
  }

  // ---- 11. Партнёрство: частицы летят от материала к продукту
  function setupParticles(row) {
    var from = $('.cut-disc', row), to = $('.product-disc', row), cnt = $('[data-count]', row);
    if (!from || !to) return;
    var qty = cnt ? parseInt(cnt.dataset.count, 10) : 40, n = Math.min(90, Math.max(18, qty || 40));
    var cv = doc.createElement('canvas'), cx = cv.getContext('2d'), running = false;
    cv.className = 'fx'; cv.setAttribute('aria-hidden', 'true'); row.appendChild(cv);
    var cols = [C.teal, C.green, C.dark, C.mint, C.orange];
    function play() {
      if (running || reduce) return;
      running = true;
      row.dataset.fx = 'run';
      var rr = row.getBoundingClientRect(), fr = from.getBoundingClientRect(), tr = to.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      var OX = 40, OY = 60, W = rr.width + OX * 2, H = rr.height + OY + 40;
      cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var sx = fr.left - rr.left + OX + fr.width / 2, sy = fr.top - rr.top + OY + fr.height / 2, ex = tr.left - rr.left + OX + tr.width / 2, ey = tr.top - rr.top + OY + tr.height / 2;
      var ps = [];
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, rd = Math.random() * fr.width * 0.35;
        ps.push({ x0: sx + Math.cos(a) * rd, y0: sy + Math.sin(a) * rd, cxp: (sx + ex) / 2 + (Math.random() - 0.5) * 90, cyp: Math.min(sy, ey) - 20 - Math.random() * 70, r: 3 + Math.random() * 3.5, col: i % 9 === 8 ? cols[4] : cols[i % 4], t0: Math.random() * 0.55, dur: 0.9 + Math.random() * 0.6 });
      }
      var start = performance.now();
      function frame(now) {
        var t = (now - start) / 1000, alive = false;
        cx.clearRect(0, 0, W, H);
        ps.forEach(function (p) {
          var u = (t - p.t0) / p.dur;
          if (u < 0) { alive = true; return; }
          if (u > 1) return;
          alive = true;
          var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, q = 1 - e;
          var x = q * q * p.x0 + 2 * q * e * p.cxp + e * e * ex, y = q * q * p.y0 + 2 * q * e * p.cyp + e * e * ey;
          cx.globalAlpha = u > 0.85 ? (1 - u) / 0.15 : 1;
          cx.fillStyle = p.col; cx.beginPath(); cx.arc(x, y, p.r, 0, Math.PI * 2); cx.fill();
        });
        if (alive) requestAnimationFrame(frame);
        else {
          cx.clearRect(0, 0, W, H); running = false; row.dataset.fx = 'idle';
          to.style.transition = 'none';
          gsap.fromTo(to, { scale: 1.14 }, { scale: 1, duration: 0.7, ease: 'back.out(3)', onComplete: function () { to.style.transition = ''; } });
        }
      }
      requestAnimationFrame(frame);
    }
    row.playParticles = play;
    // летят при каждом появлении строки в кадре, на телефоне ещё и по касанию
    ScrollTrigger.create({ trigger: row, start: 'top 78%', end: 'bottom 22%',
      onEnter: function () { setTimeout(play, 450); },
      onEnterBack: function () { setTimeout(play, 250); } });
    row.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') play(); });
    row.addEventListener('click', function () { if (!fine) play(); });
  }
  if (hasGsap) $$('.trow').forEach(setupParticles);

  // ---- 12. FAQ: плавное раскрытие по высоте
  if (hasGsap) {
    $$('.faq details').forEach(function (d) {
      var s = $('summary', d), p = $('p', d);
      if (!s || !p) return;
      s.addEventListener('click', function (e) {
        e.preventDefault();
        if (d.open) {
          p.style.overflow = 'hidden';
          gsap.to(p, { height: 0, opacity: 0, paddingBottom: 0, duration: 0.3, ease: 'power2.inOut', onComplete: function () { d.open = false; gsap.set(p, { clearProps: 'all' }); } });
        } else {
          d.open = true;
          p.style.overflow = 'hidden';
          gsap.from(p, { height: 0, opacity: 0, paddingBottom: 0, duration: 0.45, ease: 'power3.out', clearProps: 'all' });
        }
      });
    });
  }

  // ---- 13. Карта раскрывается кругом
  var map = $('.map');
  if (map && hasGsap && !reduce) gsap.fromTo(map, { clipPath: 'circle(8% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: map, start: 'top 82%', once: true } });

  // ---- 14. Техногрунт дышит
  var dogBtn = $('.dog-widget-btn');
  if (dogBtn && hasGsap && !reduce) gsap.to(dogBtn, { scale: 1.07, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });

  // ---- 15. Курсор-кольцо (только мышь; системный курсор остаётся)
  if (hasGsap && fine && !reduce) {
    var ring = doc.createElement('div');
    ring.className = 'cursor-ring'; ring.setAttribute('aria-hidden', 'true'); body.appendChild(ring);
    var rx = gsap.quickTo(ring, 'x', { duration: 0.22, ease: 'power3.out' }), ry = gsap.quickTo(ring, 'y', { duration: 0.22, ease: 'power3.out' }), rs = gsap.quickTo(ring, 'scale', { duration: 0.25, ease: 'power2.out' });
    doc.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      rx(e.clientX); ry(e.clientY);
      ring.classList.add('is-visible');
      var t = e.target.closest && e.target.closest('a, button, .chip, .quiz-option, summary, .habit, .pstep, .fraction');
      ring.classList.toggle('is-hover', !!t);
      rs(t ? 1.8 : 1);
    });
    doc.addEventListener('mouseleave', function () { ring.classList.remove('is-visible'); });
    html.addEventListener('mouseleave', function () { ring.classList.remove('is-visible'); });
  }

  // ---- 16. Всплески кругов: квиз (верный ответ, результат)
  var fx = null, fxCtx = null;
  function burst(x, y, big) {
    if (reduce) return;
    if (!fx) { fx = doc.createElement('canvas'); fx.className = 'fx-canvas'; fx.setAttribute('aria-hidden', 'true'); body.appendChild(fx); fxCtx = fx.getContext('2d'); }
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
    fx.width = W * dpr; fx.height = H * dpr; fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cols = [C.teal, C.green, C.orange, C.mint, C.dark], n = big ? 90 : 34, ps = [];
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = (big ? 420 : 260) * (0.4 + Math.random());
      ps.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (big ? 260 : 140), r: 3 + Math.random() * 5, col: cols[i % cols.length], life: 0.9 + Math.random() * 0.6 });
    }
    var last = performance.now(), t = 0;
    (function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      fxCtx.clearRect(0, 0, W, H);
      var alive = false;
      ps.forEach(function (p) {
        if (t > p.life) return;
        alive = true;
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        fxCtx.globalAlpha = Math.max(0, 1 - t / p.life); fxCtx.fillStyle = p.col;
        fxCtx.beginPath(); fxCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2); fxCtx.fill();
      });
      if (alive) requestAnimationFrame(frame); else fxCtx.clearRect(0, 0, W, H);
    })(last);
  }
  var quizBox = $('#quizBox');
  if (quizBox) {
    doc.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.quiz-option');
      if (!b || !quizBox.contains(b)) return;
      setTimeout(function () {
        var r = b.getBoundingClientRect();
        if (b.classList.contains('right')) burst(r.left + r.width / 2, r.top + r.height / 2, false);
        else if (b.classList.contains('wrong') && hasGsap && !reduce) gsap.fromTo(b, { x: -7 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
      }, 0);
    });
    // Настроение пса показывает сам ролик: не двигаем весь блок поверх видео.
    if (window.MutationObserver) {
      new MutationObserver(function () {
        var q = $('.quiz-q', quizBox);
        if (q && /^Правильных ответов/.test(q.textContent)) { var r = quizBox.getBoundingClientRect(); burst(r.left + r.width / 2, Math.max(80, r.top + 120), true); }
      }).observe(quizBox, { childList: true });
    }
  }

  if (hasGsap) window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
