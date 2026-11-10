/* Моушн-слой ССГ (ветка motion). Только opacity/transform, токены 120/200/400 мс.
   Что здесь: появление секций и групп со stagger, счётчики цифр, индикатор в меню
   и scrollspy, прогресс и перетаскивание ленты привычек, «путь пакета» с бегущей
   меткой, помощники для inline-скриптов страниц (смена картинки, вход блока). */
(function () {
  'use strict';
  var doc = document, html = doc.documentElement;
  html.classList.add('js');
  var EASE = 'cubic-bezier(.2,.6,.2,1)';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function (f) { return setTimeout(f, 16); };
  var caf = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : clearTimeout;
  var hasIO = 'IntersectionObserver' in window;
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  // ---- 1. Появление: одиночные .reveal и группы .reveal-group (дети получают --i)
  each(doc.querySelectorAll('.reveal-group'), function (g) { each(g.children, function (c, i) { c.style.setProperty('--i', i); }); });
  var targets = doc.querySelectorAll('.reveal, .reveal-group');
  if (hasIO && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    each(targets, function (el) { io.observe(el); });
  } else { each(targets, function (el) { el.classList.add('in'); }); }

  // ---- 2. Счётчики: [data-count] считает от нуля до значения, когда попадает в кадр
  function fmt(n, decimals) {
    var parts = n.toFixed(decimals || 0).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join(',');
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function countUp(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    var to = parseFloat(String(el.dataset.count).replace(/\s/g, ''));
    if (isNaN(to)) return;
    var decimals = parseInt(el.dataset.decimals, 10) || 0;
    if (reduce) { el.textContent = fmt(to, decimals); return; }
    var dur = 700, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var t = Math.min(1, (ts - t0) / dur);
      el.textContent = fmt(to * easeOut(t), decimals);
      if (t < 1) raf(step);
    }
    raf(step);
  }
  function runCounts(root) { each((root || doc).querySelectorAll('[data-count]'), countUp); }
  var counters = doc.querySelectorAll('[data-count]');
  if (hasIO && counters.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { countUp(en.target); cio.unobserve(en.target); } });
    }, { threshold: 0.6 });
    each(counters, function (el) { cio.observe(el); });
  } else runCounts();

  // ---- 3. Меню: индикатор под активным пунктом, идёт за курсором; scrollspy на главной
  var nav = doc.querySelector('.nav');
  if (nav) {
    var ink = doc.createElement('span');
    ink.className = 'nav-ink';
    ink.setAttribute('aria-hidden', 'true');
    nav.appendChild(ink);
    var links = Array.prototype.slice.call(nav.querySelectorAll('a'));
    function activeLink() { return nav.querySelector('a.active'); }
    function inkTo(a) {
      if (!a) { ink.classList.remove('on'); return; }
      var r = a.getBoundingClientRect(), n = nav.getBoundingClientRect();
      var t = 'translateX(' + (r.left - n.left) + 'px) scaleX(' + r.width + ')';
      if (!ink.classList.contains('on')) { ink.style.transition = 'none'; ink.style.transform = t; void ink.offsetWidth; ink.style.transition = ''; }
      ink.style.transform = t;
      ink.classList.add('on');
    }
    function setActive(id) {
      links.forEach(function (a) { a.classList.toggle('active', !!id && a.getAttribute('href') === '#' + id); });
      inkTo(activeLink());
    }
    if (fine) {
      nav.addEventListener('mouseover', function (e) { var a = e.target.closest('a'); if (a) inkTo(a); });
      nav.addEventListener('mouseleave', function () { inkTo(activeLink()); });
    }
    inkTo(activeLink());
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { inkTo(activeLink()); });
    window.addEventListener('resize', function () { inkTo(activeLink()); });
    var spied = links.filter(function (a) { var h = a.getAttribute('href'); return /^#./.test(h) && doc.querySelector(h); });
    if (spied.length && hasIO) {
      var ids = spied.map(function (a) { return a.getAttribute('href').slice(1); });
      var hero = doc.querySelector('.hero');
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          if (en.target === hero) setActive(null);
          else if (ids.indexOf(en.target.id) !== -1) setActive(en.target.id);
        });
      }, { rootMargin: '-40% 0px -52% 0px', threshold: 0 });
      each(doc.querySelectorAll('section[id]'), function (s) { spy.observe(s); });
      if (hero) spy.observe(hero);
    }
  }

  // ---- 4. Лента привычек: полоса прогресса, кнопки гаснут на краях, перетаскивание мышью
  var strip = doc.getElementById('habitStrip');
  if (strip) {
    var prog = doc.createElement('div');
    prog.className = 'strip-progress';
    prog.setAttribute('aria-hidden', 'true');
    var thumb = doc.createElement('span');
    thumb.className = 'strip-thumb';
    prog.appendChild(thumb);
    strip.parentNode.insertBefore(prog, strip.nextSibling);
    var prev = doc.getElementById('stripPrev'), next = doc.getElementById('stripNext'), ticking = false;
    function paint() {
      ticking = false;
      var max = strip.scrollWidth - strip.clientWidth;
      var frac = max > 0 ? strip.clientWidth / strip.scrollWidth : 1;
      var pos = max > 0 ? strip.scrollLeft / max : 0;
      thumb.style.transform = 'translateX(' + (pos * (1 - frac) * 100) + '%) scaleX(' + frac + ')';
      if (prev) prev.disabled = strip.scrollLeft <= 2;
      if (next) next.disabled = strip.scrollLeft >= max - 2;
    }
    strip.addEventListener('scroll', function () { if (!ticking) { ticking = true; raf(paint); } }, { passive: true });
    window.addEventListener('resize', paint);
    paint();
    if (fine) {
      var down = false, drag = false, x0 = 0, l0 = 0, pid = null;
      strip.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        down = true; drag = false; x0 = e.clientX; l0 = strip.scrollLeft; pid = e.pointerId;
      });
      strip.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - x0;
        if (!drag && Math.abs(dx) > 4) {
          drag = true;
          strip.classList.add('dragging');
          try { strip.setPointerCapture(pid); } catch (err) {}
        }
        if (drag) strip.scrollLeft = l0 - dx;
      });
      function release() {
        if (!down) return;
        down = false;
        if (!drag) return;
        drag = false;
        // доводим до ближайшей карточки, потом возвращаем scroll-snap
        var cards = strip.children, base = cards.length ? cards[0].offsetLeft : 0, sl = strip.scrollLeft, best = 0, bd = Infinity;
        for (var i = 0; i < cards.length; i++) {
          var left = cards[i].offsetLeft - base, d = Math.abs(left - sl);
          if (d < bd) { bd = d; best = left; }
        }
        strip.scrollTo({ left: best, behavior: reduce ? 'auto' : 'smooth' });
        setTimeout(function () { strip.classList.remove('dragging'); }, 400);
      }
      strip.addEventListener('pointerup', release);
      strip.addEventListener('pointercancel', release);
    }
  }

  // ---- 5. Путь пакета: линия заполняется, метка едет по шагам
  var proc = doc.querySelector('.process');
  if (proc) {
    var steps = Array.prototype.slice.call(proc.querySelectorAll('.pstep')), n = steps.length;
    var track = doc.createElement('div');
    track.className = 'process-track';
    track.setAttribute('aria-hidden', 'true');
    var fill = doc.createElement('div');
    fill.className = 'process-fill';
    var dot = doc.createElement('div');
    dot.className = 'process-dot';
    track.appendChild(fill);
    track.appendChild(dot);
    proc.insertBefore(track, proc.firstChild);
    var mq = window.matchMedia('(max-width: 900px)');
    var vert = false, len = 1, p = 0, anim = null;
    function centre(i) {
      var c = steps[i].querySelector('.circle');
      return { x: steps[i].offsetLeft + c.offsetLeft + c.offsetWidth / 2, y: steps[i].offsetTop + c.offsetTop + c.offsetHeight / 2 };
    }
    function render() {
      fill.style.transform = vert ? 'scaleY(' + p + ')' : 'scaleX(' + p + ')';
      dot.style.transform = vert ? 'translateY(' + (p * len) + 'px)' : 'translateX(' + (p * len) + 'px)';
      steps.forEach(function (s, i) { s.classList.toggle('is-on', p >= i / (n - 1) - 0.01); });
    }
    function layout() {
      vert = mq.matches;
      var a = centre(0), b = centre(n - 1);
      if (vert) { len = Math.max(1, b.y - a.y); track.style.cssText = 'left:' + a.x + 'px;top:' + a.y + 'px;width:1px;height:' + len + 'px'; }
      else { len = Math.max(1, b.x - a.x); track.style.cssText = 'left:' + a.x + 'px;top:' + a.y + 'px;height:1px;width:' + len + 'px'; }
      render();
    }
    function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function animateTo(target, dur) {
      if (anim) { caf(anim); anim = null; }
      if (reduce) { p = target; render(); return; }
      var from = p, t0 = null;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var t = Math.min(1, (ts - t0) / dur);
        p = from + (target - from) * easeInOut(t);
        render();
        anim = t < 1 ? raf(step) : null;
      }
      anim = raf(step);
    }
    function fromScroll() {
      var r = proc.getBoundingClientRect(), a = centre(0), b = centre(n - 1);
      var y0 = r.top + a.y, y1 = r.top + b.y, line = window.innerHeight * 0.6;
      p = Math.max(0, Math.min(1, (line - y0) / Math.max(1, y1 - y0)));
      render();
    }
    var live = false, sTick = false;
    layout();
    window.addEventListener('resize', layout);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(layout);
    window.addEventListener('scroll', function () {
      if (!live || !mq.matches || sTick) return;
      sTick = true;
      raf(function () { sTick = false; fromScroll(); });
    }, { passive: true });
    function goLive() {
      live = true;
      proc.classList.add('is-live');
      if (mq.matches) fromScroll(); else animateTo(1, 1200);
    }
    if (hasIO) {
      var pio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { goLive(); pio.unobserve(proc); } });
      }, { threshold: 0.2 });
      pio.observe(proc);
    } else goLive();
    // на десктопе наведение или клик по шагу ведут метку к нему; уход с блока — обратно в конец
    steps.forEach(function (s, i) {
      s.addEventListener('pointerenter', function (e) { if (live && e.pointerType === 'mouse' && !mq.matches) animateTo(i / (n - 1), 400); });
      s.addEventListener('click', function () { if (live && !mq.matches) animateTo(i / (n - 1), 400); });
    });
    proc.addEventListener('pointerleave', function (e) { if (live && e.pointerType === 'mouse' && !mq.matches) animateTo(1, 400); });
  }

  // ---- 6. Мобильное меню: ссылки получают порядок для stagger
  each(doc.querySelectorAll('.mobile-menu > a'), function (a, i) { a.style.setProperty('--i', i); });

  // ---- 7. Помощники для inline-скриптов страниц
  // Новая картинка грузится в фоне, старая остаётся на месте до самой замены:
  // раньше круг сразу пустел и на медленной сети стоял пустым, пока шла загрузка.
  function swapImage(img, src) {
    if (img.getAttribute('src') === src) return;
    img.setAttribute('data-want', src);
    var pre = new Image();
    pre.decoding = 'async';
    pre.src = src;
    var shown = false;
    function show() {
      if (shown || img.getAttribute('data-want') !== src) return;  // пока грузилась, выбрали другую
      shown = true;
      img.src = src;
      if (!reduce && img.animate) img.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE });
    }
    if (pre.decode) pre.decode().then(show, show);
    else { pre.onload = show; pre.onerror = show; }
  }
  function enter(el) {
    if (reduce || !el.animate) return;
    el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE });
  }
  window.ssgMotion = { count: runCounts, swapImage: swapImage, enter: enter };
})();
