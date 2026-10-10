/* Lab 5 · Viscosity by Stokes' method — lesson app (no dependencies) */
(function () {
  'use strict';

  /* =====================================================================
     1. CONSTANTS + HELPERS
     ===================================================================== */
  const RHO_S = 7.86, RHO_L = 1.26, G_CGS = 980;
  /* Example readings: generated from Stokes' law for glycerin with η = 12.0 P (≈ 22 °C),
     D = 30.0 cm, t = D / v rounded to 0.01 s, v = D / t rounded to 0.01 cm/s.
     The slope from balls 1 and 3 is 6.00 / 0.05 = 120.0, giving η = 1437.33 / 120.0 = 11.98 P. */
  const ETA_GLY = 12.0; // poise: the glycerin in the simulated practical
  const LAB = { D: 30.0, balls: [
    { n: 1, r: 0.2, r2: 0.04, t: 6.26, v: 4.79 },
    { n: 2, r: 0.25, r2: 0.0625, t: 4.01, v: 7.48 },
    { n: 3, r: 0.3, r2: 0.09, t: 2.78, v: 10.79 }
  ], S: 120.0, eta: 11.98 };
  const etaFrom = (S, g) => (2 / 9) * (RHO_S - RHO_L) * (g == null ? G_CGS : g) / S;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, attrs) { const t = el('text', Object.assign({ x, y }, attrs || {}), parent); t.textContent = s; return t; }
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (v, d) => Number(v).toFixed(d);
  function trimNum(v, d) { return String(+Number(v).toFixed(d)); }
  function svgPoint(svg, e) {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function radioGroup(id, onPick) {
    const box = $(id);
    const btns = Array.from(box.querySelectorAll('[role=radio]'));
    btns.forEach(b => b.addEventListener('click', () => { set(b); onPick(b); }));
    function set(b) { btns.forEach(x => x.setAttribute('aria-checked', x === b ? 'true' : 'false')); }
    return { btns, set, get: () => btns.find(b => b.getAttribute('aria-checked') === 'true') };
  }
  function parseNum(s) { if (s == null) return NaN; s = String(s).trim().replace(',', '.').replace(/\s/g, ''); if (!s) return NaN; return Number(s); }

  /* Glass-cylinder gradients (shared defs per svg) */
  function glassDefs(svg, id) {
    const defs = el('defs', null, svg);
    let g = el('linearGradient', { id: id + '-glass', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    [['0', '#ffffff', .55], ['.12', '#ffffff', .12], ['.5', '#ffffff', .04], ['.82', '#ffffff', .2], ['.9', '#ffffff', .55], ['1', '#ffffff', .1]].forEach(s => el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] }, g));
    g = el('linearGradient', { id: id + '-gly', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    [['0', '#e4b85e', .75], ['.35', '#f6dc9e', .55], ['.7', '#f1cf82', .6], ['1', '#d7a240', .8]].forEach(s => el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] }, g));
    g = el('linearGradient', { id: id + '-honey', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    [['0', '#c27a10', .9], ['.4', '#e7a332', .85], ['1', '#b06c0a', .95]].forEach(s => el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] }, g));
    g = el('linearGradient', { id: id + '-water', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    [['0', '#bcdbe9', .7], ['.4', '#e6f3f9', .5], ['1', '#a9cfe1', .75]].forEach(s => el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] }, g));
    g = el('linearGradient', { id: id + '-custom', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    [['0', '#c9b8d8', .7], ['.4', '#eee6f4', .5], ['1', '#b8a3cb', .75]].forEach(s => el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] }, g));
    g = el('radialGradient', { id: id + '-steel', cx: .35, cy: .3, r: .75 }, defs);
    [['0', '#ffffff'], ['.35', '#c3cad0'], ['.8', '#5d6872'], ['1', '#3d464e']].forEach(s => el('stop', { offset: s[0], 'stop-color': s[1] }, g));
    g = el('radialGradient', { id: id + '-glassball', cx: .35, cy: .3, r: .75 }, defs);
    [['0', '#ffffff'], ['.5', '#cfe6ee'], ['1', '#7fa9b9']].forEach(s => el('stop', { offset: s[0], 'stop-color': s[1] }, g));
    g = el('radialGradient', { id: id + '-plastic', cx: .35, cy: .3, r: .75 }, defs);
    [['0', '#ffd9cf'], ['.5', '#e0705a'], ['1', '#9c3b28']].forEach(s => el('stop', { offset: s[0], 'stop-color': s[1] }, g));
    return defs;
  }

  /* =====================================================================
     2. BACKGROUND — slow laminar flow (parabolic velocity profile)
     ===================================================================== */
  (function bgFlow() {
    const cv = $('bg-flow'), ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, lanes = [], t0 = performance.now();
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(10, Math.round(H / 46));
      lanes = [];
      for (let i = 0; i < n; i++) {
        const f = (i + .5) / n;                       // 0..1 across the "pipe"
        const prof = 4 * f * (1 - f);                 // parabolic: fastest in the middle
        lanes.push({ y: f * H, speed: 6 + 26 * prof, amp: 5 + 7 * prof, ph: Math.random() * 6.28, hue: i % 3, prof,
          drops: Array.from({ length: 3 }, () => ({ x: Math.random() * W, len: 40 + Math.random() * 90 })) });
      }
    }
    function laneY(L, x, t) { return L.y + Math.sin(x / 260 + L.ph + t * .05) * L.amp; }
    function draw(now) {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      lanes.forEach(L => {
        ctx.beginPath();
        for (let x = -10; x <= W + 10; x += 24) { const y = laneY(L, x, t); x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.strokeStyle = `rgba(${L.hue === 0 ? '212,149,31' : L.hue === 1 ? '190,140,60' : '120,135,150'},${.05 + .06 * L.prof})`;
        ctx.lineWidth = 1.2; ctx.stroke();
        L.drops.forEach(d => {
          const x = ((d.x + t * L.speed) % (W + d.len * 2)) - d.len;
          const grad = ctx.createLinearGradient(x - d.len, 0, x, 0);
          grad.addColorStop(0, 'rgba(233,178,74,0)'); grad.addColorStop(1, `rgba(212,149,31,${.12 + .18 * L.prof})`);
          ctx.beginPath();
          for (let k = 0; k <= 8; k++) { const xx = x - d.len + d.len * k / 8, yy = laneY(L, xx, t); k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
          ctx.strokeStyle = grad; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.stroke();
          ctx.beginPath(); ctx.arc(x, laneY(L, x, t), 2.4, 0, 6.283); ctx.fillStyle = `rgba(212,149,31,${.18 + .2 * L.prof})`; ctx.fill();
        });
      });
      if (!reduced) requestAnimationFrame(draw);
    }
    window.addEventListener('resize', size);
    size(); requestAnimationFrame(draw);
  })();

  /* =====================================================================
     3. NAVIGATION + HONEY RAIL
     ===================================================================== */
  const views = Array.from(document.querySelectorAll('.view'));
  const ids = views.map(v => v.id.replace('view-', ''));
  const nav = $('rail-nav'), honey = $('rail-honey'), btnPrev = $('btn-prev');
  const items = views.map((v, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rail-item';
    b.innerHTML = `<span>${v.dataset.title}</span>`;
    b.addEventListener('click', () => goTo(i, true));
    nav.appendChild(b);
    return b;
  });
  let current = -1;
  const onEnter = {}, onLeave = {};
  function fillRail() {
    const it = items[current]; if (!it) return;
    const mobile = window.matchMedia('(max-width:980px)').matches;
    if (mobile) { honey.style.setProperty('--fillw', ((current + 1) / items.length * 100) + '%'); honey.style.height = ''; }
    else {
      const tb = honey.parentElement.getBoundingClientRect(), ib = it.getBoundingClientRect();
      honey.style.height = clamp(ib.top + ib.height / 2 - tb.top, 0, tb.height) + 'px';
    }
  }
  function goTo(i, push) {
    i = clamp(i, 0, views.length - 1);
    if (i === current) return;
    if (current >= 0 && onLeave[ids[current]]) onLeave[ids[current]]();
    current = i;
    views.forEach((v, k) => v.classList.toggle('active', k === i));
    items.forEach((b, k) => {
      b.classList.toggle('current', k === i); b.classList.toggle('done', k < i);
      if (k === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    btnPrev.hidden = i === 0;
    document.querySelector('.stage-top').style.maxWidth = views[i].querySelector('.sheet.wide') ? '1180px' : '';
    requestAnimationFrame(() => {
      fillRail();
      if (window.matchMedia('(max-width:980px)').matches) items[i].scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    if (push && location.hash !== '#' + ids[i]) history.pushState(null, '', '#' + ids[i]);
    window.scrollTo({ top: 0 });
    document.title = views[i].dataset.title.replace('&amp;', '&') + " · Viscosity by Stokes' method · Lab 5";
    if (onEnter[ids[i]]) onEnter[ids[i]]();
  }
  window.addEventListener('resize', () => requestAnimationFrame(fillRail));
  btnPrev.addEventListener('click', () => goTo(current - 1, true));
  document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => goTo(current + 1, true)));
  function fromHash() { const k = ids.indexOf(location.hash.replace('#', '')); return k < 0 ? 0 : k; }
  window.addEventListener('popstate', () => goTo(fromHash(), false));
  window.addEventListener('hashchange', () => goTo(fromHash(), false));

  /* =====================================================================
     4. CUSTOM CURSOR — honey droplet; marker / eraser in the Practical
     ===================================================================== */
  const cur = $('cursor');
  const fine = window.matchMedia('(pointer:fine)').matches;
  if (fine) {
    window.addEventListener('mousemove', e => {
      if (!document.body.classList.contains('has-cursor')) document.body.classList.add('has-cursor');
      cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      cur.classList.remove('hidden');
      const hot = e.target.closest && e.target.closest('button, a, input, select, label, [role="button"], .pt-hit');
      cur.classList.toggle('hot', !!hot);
    }, { passive: true });
    document.addEventListener('mouseleave', () => cur.classList.add('hidden'));
    window.addEventListener('blur', () => cur.classList.add('hidden'));
  }
  function setCursorTool(tool) {
    ['marker', 'eraser', 'tweezers', 'magnet'].forEach(t => cur.classList.toggle('tool-' + t, tool === t));
  }

  /* =====================================================================
     5. AIM HERO — ball sinking through glycerin between X and Y
     ===================================================================== */
  function handMark(x0, x1, y, seed, amp) {
    let s = seed || 1; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    amp = amp == null ? 0.9 : amp;
    const n = 9, pts = [];
    for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y + (rnd() - .5) * 2 * amp + Math.sin(i * 1.3 + seed) * amp * .4]);
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`;
    }
    return d + ` L${pts[n][0].toFixed(1)} ${pts[n][1].toFixed(1)}`;
  }
  function drawCylinder(g, id, x0, x1, yTop, yBot, liquidTop, fill, opts) {
    opts = opts || {};
    const w = x1 - x0;
    el('rect', { x: x0 - 22, y: yBot, width: w + 44, height: 12, rx: 6, fill: '#d8ccb1', stroke: '#b8a77f' }, g);
    el('path', { d: `M${x0} ${liquidTop} L${x0} ${yBot - 6} Q${x0} ${yBot} ${x0 + 6} ${yBot} L${x1 - 6} ${yBot} Q${x1} ${yBot} ${x1} ${yBot - 6} L${x1} ${liquidTop} Z`, fill: `url(#${id}-${fill})` }, g);
    el('ellipse', { cx: (x0 + x1) / 2, cy: liquidTop, rx: w / 2, ry: Math.min(6, w * .08), fill: fill === 'honey' ? '#f0bc55' : fill === 'water' ? '#d9ecf5' : fill === 'custom' ? '#e2d8ec' : '#f8e2ad', opacity: .9 }, g);
    el('path', { d: `M${x0} ${yTop} L${x0} ${yBot - 6} Q${x0} ${yBot} ${x0 + 6} ${yBot} L${x1 - 6} ${yBot} Q${x1} ${yBot} ${x1} ${yBot - 6} L${x1} ${yTop}`, fill: `url(#${id}-glass)`, stroke: '#9fa9b0', 'stroke-width': opts.sw || 2 }, g);
    el('ellipse', { cx: (x0 + x1) / 2, cy: yTop, rx: w / 2 + 3, ry: Math.min(5, w * .07), fill: 'none', stroke: '#9fa9b0', 'stroke-width': opts.sw || 2 }, g);
    el('rect', { x: x0 + w * .1, y: yTop + 12, width: Math.max(2, w * .05), height: yBot - yTop - 30, rx: 2, fill: '#fff', opacity: .55 }, g);
  }
  (function aimHero() {
    const svg = $('aim-hero'); const id = 'ah'; glassDefs(svg, id);
    const g = el('g', null, svg);
    drawCylinder(g, id, 105, 195, 26, 392, 58, 'gly', { sw: 2.4 });
    const X = 128, Y = 318;
    el('path', { d: handMark(103, 197, X, 3, 1.1), stroke: '#26313b', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, g);
    el('path', { d: handMark(103, 197, Y, 7, 1.1), stroke: '#26313b', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, g);
    txt(g, 88, X + 9, 'X', { class: 'hand', 'font-size': 30, fill: '#2f6f8f', 'text-anchor': 'end', 'font-family': 'Caveat, cursive', 'font-weight': 700 });
    txt(g, 88, Y + 9, 'Y', { class: 'hand', 'font-size': 30, fill: '#2f6f8f', 'text-anchor': 'end', 'font-family': 'Caveat, cursive', 'font-weight': 700 });
    el('path', { d: `M230 ${X + 2} L230 ${Y - 2}`, stroke: '#9b5a08', 'stroke-width': 1.8 }, g);
    el('path', { d: `M224 ${X + 10} L230 ${X + 1} L236 ${X + 10} M224 ${Y - 10} L230 ${Y - 1} L236 ${Y - 10}`, stroke: '#9b5a08', 'stroke-width': 1.8, fill: 'none' }, g);
    el('path', { d: `M200 ${X} L238 ${X} M200 ${Y} L238 ${Y}`, stroke: '#9b5a08', 'stroke-width': 1, 'stroke-dasharray': '3 3' }, g);
    txt(g, 244, (X + Y) / 2 + 10, 'D', { 'font-size': 32, fill: '#9b5a08', 'font-family': 'Fraunces, serif', 'font-style': 'italic' });
    const ball = el('circle', { cx: 150, cy: 62, r: 7, fill: `url(#${id}-steel)` }, g);
    if (!reduced) {
      // speeds up for a moment below the surface, then sinks at constant terminal velocity
      el('animate', { attributeName: 'cy', dur: '6s', repeatCount: 'indefinite', values: '52;62;78;100;378;378', keyTimes: '0;0.06;0.12;0.18;0.88;1', calcMode: 'spline', keySplines: '.4 0 1 1;.4 0 1 1;.3 .2 .7 .9;0 0 1 1;0 0 1 1' }, ball);
      el('animate', { attributeName: 'opacity', dur: '6s', repeatCount: 'indefinite', values: '0;1;1;0', keyTimes: '0;0.04;0.9;1' }, ball);
    } else ball.setAttribute('cy', 210);
    txt(g, 150, 412, 'glycerin', { 'text-anchor': 'middle', 'font-size': 22, fill: '#7a6f5f', 'font-family': 'Caveat, cursive' });
  })();

  /* =====================================================================
     6. CONCEPT — sliding layers + falling-ball comparison
     ===================================================================== */
  (function layers() {
    const svg = $('layers-svg');
    const defs = el('defs', null, svg);
    const pat = el('pattern', { id: 'hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: '#8b96a0', 'stroke-width': 2 }, pat);
    el('rect', { x: 20, y: 170, width: 400, height: 16, fill: 'url(#hatch)' }, svg);
    el('line', { x1: 20, y1: 170, x2: 420, y2: 170, stroke: '#5d6872', 'stroke-width': 2 }, svg);
    const n = 5, h = 26;
    const m0 = el('marker', { id: 'arrV', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' }, defs);
    el('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#9b5a08' }, m0);
    for (let i = 0; i < n; i++) {
      const y = 166 - (i + 1) * h, f = (i + 1) / n;
      const shade = ['#fbe8bd', '#f8dc9c', '#f4cd7a', '#efbd58', '#e8ab3a'][i];
      el('rect', { x: 20, y, width: 400, height: h - 3, rx: 6, fill: shade, opacity: .9 }, svg);
      const gg = el('g', null, svg);
      for (let k = 0; k < 5; k++) el('circle', { cx: 40 + k * 82, cy: y + h / 2 - 1.5, r: 3, fill: '#9b5a08', opacity: .55 }, gg);
      if (!reduced) el('animateTransform', { attributeName: 'transform', type: 'translate', from: '0 0', to: '82 0', dur: (4 / f).toFixed(2) + 's', repeatCount: 'indefinite' }, gg);
      el('line', { x1: 430, y1: y + h / 2 - 1.5, x2: 432 + 72 * f, y2: y + h / 2 - 1.5, stroke: '#9b5a08', 'stroke-width': 2, 'marker-end': 'url(#arrV)' }, svg);
    }
    el('path', { d: `M430 ${166 - 1.5} L${432 + 72} ${166 - n * h + h / 2 - 1.5}`, stroke: '#9b5a08', 'stroke-width': 1, 'stroke-dasharray': '3 3', fill: 'none' }, svg);
    el('rect', { x: 18, y: 166 - n * h - 14, width: 404, height: 12, rx: 4, fill: '#8b96a0' }, svg);
    el('path', { d: `M250 ${166 - n * h - 8} h110`, stroke: '#2f6f8f', 'stroke-width': 3, 'marker-end': 'url(#arrF)' }, svg);
    const m = el('marker', { id: 'arrF', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, defs);
    el('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#2f6f8f' }, m);
    txt(svg, 368, 166 - n * h - 2, 'F', { 'font-size': 22, fill: '#2f6f8f', 'font-family': 'Fraunces, serif', 'font-style': 'italic' });
    txt(svg, 40, 166 - n * h - 20, 'moving plate', { 'font-size': 22, fill: '#5d6872', 'font-family': 'Caveat, cursive' });
    txt(svg, 40, 198, 'fixed surface: layer at rest', { 'font-size': 22, fill: '#5d6872', 'font-family': 'Caveat, cursive' });
  })();

  /* ---- liquids: viscosity (poise) vs temperature, densities g/cm³ ---- */
  const TEMPS = [10, 20, 30, 40, 50];
  const LIQ = [
    { key: 'water', name: 'Water', rho: 1.00, fill: 'water', eta: [0.0131, 0.0100, 0.0080, 0.00653, 0.00547] },
    { key: 'gly', name: 'Glycerin', rho: 1.26, fill: 'gly', eta: [39.5, 14.1, 6.12, 2.84, 1.42] },
    { key: 'honey', name: 'Honey', rho: 1.42, fill: 'honey', eta: [600, 100, 30, 10, 4] },
    { key: 'custom', name: 'Custom liquid', rho: 1.26, fill: 'custom', eta: null }
  ];
  function etaAt(L, T) {
    let i = 0; while (i < TEMPS.length - 2 && T > TEMPS[i + 1]) i++;
    const f = (T - TEMPS[i]) / (TEMPS[i + 1] - TEMPS[i]);
    return Math.exp(Math.log(L.eta[i]) * (1 - f) + Math.log(L.eta[i + 1]) * f);
  }
  function termV(r, rs, rl, eta) {
    const dr = rs - rl; if (dr <= 0) return 0;
    const vS = (2 / 9) * dr * G_CGS * r * r / eta;
    const vN = Math.sqrt(8 * r * G_CGS * dr / (3 * 0.44 * rl));
    return vS * vN / (vS + vN);
  }
  function fmtEta(e) { return e < 0.1 ? e.toFixed(4) : e < 10 ? e.toFixed(2) : e < 100 ? e.toFixed(1) : Math.round(e).toString(); }
  (function fallLab() {
    const box = $('fall-tubes');
    const TOP = 46, BOT = 366, PXCM = 16; // 20 cm of liquid
    const st = { T: 20, etaC: 11.98, r: 0.2, rs: 7.86, run: null };
    const tubes = LIQ.map((L, i) => {
      const wrap = document.createElement('div'); wrap.className = 'fall-tube';
      const svg = el('svg', { viewBox: '0 0 120 390', role: 'img', 'aria-label': L.name + ' tube' });
      wrap.appendChild(svg);
      const id = 'ft' + i; glassDefs(svg, id);
      drawCylinder(el('g', null, svg), id, 32, 88, 22, 374, TOP, L.fill);
      for (let c = 0; c <= 20; c += 5) { const y = TOP + c * PXCM; el('line', { x1: 88, y1: y, x2: 96, y2: y, stroke: '#8b96a0', 'stroke-width': 1 }, svg); }
      const ball = el('circle', { cx: 60, cy: TOP, r: 5, fill: `url(#${id}-steel)` }, svg);
      const nm = document.createElement('div'); nm.className = 'ft-name'; nm.textContent = L.name;
      const et = document.createElement('div'); et.className = 'ft-eta';
      const tm = document.createElement('div'); tm.className = 'ft-time';
      wrap.append(nm, et, tm); box.appendChild(wrap);
      return { L, svg, ball, et, tm, id };
    });
    function etaOf(L) { return L.key === 'custom' ? st.etaC : etaAt(L, st.T); }
    function refresh() {
      tubes.forEach(tb => {
        const e = etaOf(tb.L), v = termV(st.r, st.rs, tb.L.rho, e);
        tb.et.innerHTML = `η ≈ ${fmtEta(e)} P<br>v ≈ ${v === 0 ? '0' : v < 1 ? v.toFixed(2) : v.toFixed(1)} cm/s`;
        const mat = st.rs > 5 ? 'steel' : st.rs > 2 ? 'glassball' : 'plastic';
        tb.ball.setAttribute('fill', `url(#${tb.id}-${mat})`);
        tb.ball.setAttribute('r', (2.5 + st.r * 16).toFixed(1));
      });
    }
    function drop() {
      if (st.run) cancelAnimationFrame(st.run.raf);
      const rs = st.rs;
      const P = tubes.map(tb => {
        const v = termV(st.r, rs, tb.L.rho, etaOf(tb.L));
        const aEff = G_CGS * (1 - tb.L.rho / rs);
        const tau = v > 0 ? clamp(v / aEff, 0.004, 0.25) : 0;
        tb.tm.textContent = v === 0 ? 'floats' : '';
        return { tb, v, tau, done: v === 0 };
      });
      const t0 = performance.now();
      function step(now) {
        const t = (now - t0) / 1000; let alive = false;
        P.forEach(p => {
          if (p.done) { if (p.v === 0) p.tb.ball.setAttribute('cy', TOP - 2); return; }
          const s = p.v * (t - p.tau * (1 - Math.exp(-t / p.tau)));
          const rr = +p.tb.ball.getAttribute('r');
          const y = Math.min(TOP + s * PXCM, BOT - rr - 6);
          p.tb.ball.setAttribute('cy', y.toFixed(2));
          if (s >= 20) { p.done = true; p.tb.tm.textContent = `20 cm in ${t < 10 ? t.toFixed(2) : t.toFixed(1)} s`; }
          else { alive = true; p.tb.tm.textContent = t.toFixed(1) + ' s'; }
        });
        if (alive) st.run.raf = requestAnimationFrame(step); else st.run = null;
      }
      st.run = { raf: requestAnimationFrame(step) };
    }
    function stop() { if (st.run) { cancelAnimationFrame(st.run.raf); st.run = null; } tubes.forEach(tb => { tb.ball.setAttribute('cy', TOP); tb.tm.textContent = ''; }); }
    const temp = $('c-temp'), eta = $('c-eta'), rad = $('c-rad');
    temp.addEventListener('input', () => { st.T = +temp.value; $('c-temp-o').textContent = st.T + ' °C'; stop(); refresh(); });
    eta.addEventListener('input', () => { st.etaC = Math.pow(10, -2 + 4 * eta.value / 1000); $('c-eta-o').textContent = fmtEta(st.etaC) + ' P'; stop(); refresh(); });
    rad.addEventListener('input', () => { st.r = +rad.value; $('c-rad-o').textContent = st.r.toFixed(2) + ' cm'; stop(); refresh(); });
    radioGroup('c-mat', b => { st.rs = +b.dataset.rho; stop(); refresh(); });
    $('c-drop').addEventListener('click', drop);
    st.etaC = Math.pow(10, -2 + 4 * eta.value / 1000); $('c-eta-o').textContent = fmtEta(st.etaC) + ' P';
    refresh();
    onLeave.concept = stop;
  })();

  (function factorIcons() {
    const ic = {
      temp: '<svg viewBox="0 0 28 28"><rect x="11" y="3" width="6" height="16" rx="3" fill="none" stroke="#9b5a08" stroke-width="2"/><circle cx="14" cy="21" r="4.5" fill="#d4951f"/><path d="M14 20V10" stroke="#d4951f" stroke-width="2.4"/></svg>',
      liquid: '<svg viewBox="0 0 28 28"><path d="M14 3S6 13 6 18a8 8 0 0 0 16 0C22 13 14 3 14 3z" fill="#e9b24a" stroke="#9b5a08" stroke-width="1.6"/></svg>',
      size: '<svg viewBox="0 0 28 28"><circle cx="8" cy="18" r="3.5" fill="#8b96a0"/><circle cx="19" cy="14" r="7" fill="#5d6872"/></svg>',
      density: '<svg viewBox="0 0 28 28"><path d="M4 20h20" stroke="#9b5a08" stroke-width="2"/><circle cx="14" cy="11" r="5" fill="#5d6872"/><path d="M14 16v8M11 21l3 3 3-3" stroke="#2f6f8f" stroke-width="2" fill="none"/></svg>'
    };
    document.querySelectorAll('.f-ic').forEach(d => { d.innerHTML = ic[d.dataset.ic]; });
  })();

  /* =====================================================================
     7. MEDICAL VISUALS
     ===================================================================== */
  const HAND = { 'font-family': 'Caveat, cursive', 'font-weight': 600 };
  function rbc(g, x, y, s) {
    el('ellipse', { cx: x, cy: y, rx: 7 * s, ry: 4.6 * s, fill: '#c8432f' }, g);
    el('ellipse', { cx: x, cy: y, rx: 3.4 * s, ry: 1.9 * s, fill: '#9e2f20', opacity: .7 }, g);
  }
  (function medBlood() {
    const svg = $('med-blood');
    [[14, 'normal blood', 10, 3.2], [100, 'thick blood: heart works harder', 26, 9]].forEach(([y0, lab, nCells, dur], k) => {
      el('rect', { x: 14, y: y0, width: 292, height: 54, rx: 27, fill: '#f6d3c6', stroke: '#c26a55', 'stroke-width': 3 }, svg);
      el('rect', { x: 18, y: y0 + 6, width: 284, height: 42, rx: 21, fill: k ? '#efb8a7' : '#f8e1d7' }, svg);
      const clip = el('clipPath', { id: 'bc' + k }, svg); el('rect', { x: 18, y: y0 + 6, width: 284, height: 42, rx: 21 }, clip);
      const outer = el('g', { 'clip-path': `url(#bc${k})` }, svg);
      const g = el('g', null, outer);
      let s = 11 + k * 7; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      for (let rep = 0; rep < 2; rep++) for (let i = 0; i < nCells; i++) rbc(g, 20 + rep * 292 + (i + rnd() * .6) * 292 / nCells, y0 + 14 + rnd() * 26, .9 + rnd() * .25);
      if (!reduced) el('animateTransform', { attributeName: 'transform', type: 'translate', from: '-292 0', to: '0 0', dur: dur + 's', repeatCount: 'indefinite' }, g);
      txt(svg, 20, y0 + 74, lab, Object.assign({ 'font-size': 21, fill: '#7a3b2c' }, HAND));
    });
  })();
  (function medIV() {
    const svg = $('med-iv');
    [[70, '#e8f3f8', 'saline', 0.9, '#9fc6d8'], [220, '#f2d27e', 'thick fluid', 2.6, '#c9952c']].forEach(([cx, col, lab, dur, edge]) => {
      el('line', { x1: cx, y1: 4, x2: cx, y2: 14, stroke: '#8b96a0', 'stroke-width': 2 }, svg);
      el('path', { d: `M${cx - 30} 18 h60 v58 q0 14 -14 14 h-32 q-14 0 -14 -14 z`, fill: col, stroke: edge, 'stroke-width': 2 }, svg);
      el('rect', { x: cx - 22, y: 32, width: 44, height: 20, rx: 3, fill: '#fff', opacity: .7 }, svg);
      txt(svg, cx, 47, lab, Object.assign({ 'font-size': 17, fill: '#4a4237', 'text-anchor': 'middle' }, HAND));
      el('rect', { x: cx - 4, y: 90, width: 8, height: 10, fill: '#cfd6db' }, svg);
      el('rect', { x: cx - 10, y: 100, width: 20, height: 34, rx: 6, fill: 'rgba(255,255,255,.6)', stroke: '#9fa9b0', 'stroke-width': 1.5 }, svg);
      el('rect', { x: cx - 9, y: 122, width: 18, height: 11, rx: 4, fill: col, stroke: edge }, svg);
      const d = el('ellipse', { cx, cy: 104, rx: 2.6, ry: 3.4, fill: edge }, svg);
      if (!reduced) {
        el('animate', { attributeName: 'cy', values: '103;103;121', keyTimes: '0;.6;1', dur: dur + 's', repeatCount: 'indefinite' }, d);
        el('animate', { attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;.3;.95;1', dur: dur + 's', repeatCount: 'indefinite' }, d);
      }
      el('path', { d: `M${cx} 134 C${cx} 160 ${cx + 30} 166 ${cx + 52} 170`, fill: 'none', stroke: '#9fa9b0', 'stroke-width': 3 }, svg);
      txt(svg, dur < 1 ? cx + 44 : 314, 154, dur < 1 ? 'fast drip' : 'slow drip', Object.assign({ 'font-size': 18, fill: '#2f6f8f', 'text-anchor': dur < 1 ? 'start' : 'end' }, HAND));
    });
  })();
  (function medCirc() {
    const svg = $('med-circ');
    el('path', { d: 'M10 70 h90', stroke: '#d0634c', 'stroke-width': 30, 'stroke-linecap': 'round' }, svg);
    for (let i = 0; i < 6; i++) {
      const yy = 22 + i * 19;
      el('path', { d: `M98 70 C140 70 140 ${yy} 186 ${yy} S 236 ${yy + 6} 250 ${yy + 4}`, stroke: i % 2 ? '#d98a78' : '#c96a5a', 'stroke-width': 5 - Math.abs(2.5 - i) * .6, fill: 'none', 'stroke-linecap': 'round' }, svg);
    }
    el('path', { d: 'M250 26 C280 40 280 100 300 116', stroke: '#6f86b8', 'stroke-width': 8, fill: 'none', 'stroke-linecap': 'round' }, svg);
    // velocity profile in the artery
    const defs = el('defs', null, svg);
    const m = el('marker', { id: 'mcArr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto' }, defs);
    el('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#fff' }, m);
    for (let k = -2; k <= 2; k++) {
      const L = 8 + 30 * (1 - (k / 2.6) ** 2);
      el('line', { x1: 24, y1: 70 + k * 5.5, x2: 24 + L, y2: 70 + k * 5.5, stroke: '#fff', 'stroke-width': 1.6, 'marker-end': 'url(#mcArr)' }, svg);
    }
    txt(svg, 12, 120, 'fastest in the centre', Object.assign({ 'font-size': 19, fill: '#7a3b2c' }, HAND));
    txt(svg, 12, 142, 'slowest at the wall', Object.assign({ 'font-size': 19, fill: '#7a3b2c' }, HAND));
    txt(svg, 196, 172, 'capillaries', Object.assign({ 'font-size': 19, fill: '#5d6872' }, HAND));
  })();

  /* =====================================================================
     8. METHOD — step illustrations
     ===================================================================== */
  (function method() {
    const fig = $('step-fig'), cap = $('step-cap');
    const steps = Array.from(document.querySelectorAll('#steps .step'));
    const CAPS = [
      'The micrometer reads the diameter d. Halve it to get the radius r = d / 2.',
      'Fill the tall cylinder almost to the top. Let air bubbles rise out before starting.',
      'Draw X a few centimetres below the surface and Y well below it, but above the base. D is the distance between them.',
      'Wet the sphere in glycerin and release it gently at the centre of the surface, away from the walls.',
      'Start the watch as the sphere passes X and stop it at Y. By X it is already at constant (terminal) velocity.',
      'A bigger sphere falls faster. Each sphere gives one row of the table.',
      'For each sphere: square the radius, and divide D by the time.',
      'v on the y-axis, r² on the x-axis. The points lie close to a straight line.',
      'Put the slope into the formula, with g = 980 cm/s².'
    ];
    function frame() {
      const svg = el('svg', { viewBox: '0 0 460 400', role: 'img' });
      glassDefs(svg, 'ms'); return svg;
    }
    function tube(svg, opts) {
      opts = opts || {};
      const g = el('g', null, svg);
      drawCylinder(g, 'ms', 180, 260, 30, 370, opts.level == null ? 54 : opts.level, 'gly', { sw: 2.2 });
      return g;
    }
    function marks(svg, X, Y, labels) {
      el('path', { d: handMark(178, 262, X, 3), stroke: '#26313b', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, svg);
      el('path', { d: handMark(178, 262, Y, 9), stroke: '#26313b', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, svg);
      if (labels !== false) {
        txt(svg, 164, X + 9, 'X', Object.assign({ 'font-size': 30, fill: '#2f6f8f', 'text-anchor': 'end' }, HAND));
        txt(svg, 164, Y + 9, 'Y', Object.assign({ 'font-size': 30, fill: '#2f6f8f', 'text-anchor': 'end' }, HAND));
      }
    }
    function ball(svg, x, y, r) { return el('circle', { cx: x, cy: y, r, fill: 'url(#ms-steel)' }, svg); }
    const D = [
      function s1() {
        const svg = frame();
        el('path', { d: 'M60 120 h70 v130 h-70 z', fill: '#d6dbe0', stroke: '#8b96a0', 'stroke-width': 2 }, svg);
        el('path', { d: 'M60 120 C 20 150 20 290 120 300 L 330 300', fill: 'none', stroke: '#5d6872', 'stroke-width': 18, 'stroke-linecap': 'round' }, svg);
        el('rect', { x: 130, y: 172, width: 60, height: 26, fill: '#c3cad0', stroke: '#8b96a0' }, svg);
        ball(svg, 205, 185, 14);
        el('rect', { x: 219, y: 172, width: 50, height: 26, fill: '#c3cad0', stroke: '#8b96a0' }, svg);
        el('rect', { x: 269, y: 168, width: 70, height: 34, fill: '#e4e8eb', stroke: '#8b96a0' }, svg);
        for (let i = 0; i < 6; i++) el('line', { x1: 275 + i * 10, y1: 185, x2: 275 + i * 10, y2: i % 2 ? 179 : 175, stroke: '#3d464e', 'stroke-width': 1.5 }, svg);
        el('line', { x1: 270, y1: 185, x2: 338, y2: 185, stroke: '#3d464e', 'stroke-width': 1 }, svg);
        el('rect', { x: 339, y: 160, width: 74, height: 50, rx: 6, fill: '#aab3bb', stroke: '#5d6872' }, svg);
        for (let i = 0; i < 7; i++) el('line', { x1: 339, y1: 166 + i * 6.5, x2: 351, y2: 166 + i * 6.5, stroke: '#3d464e', 'stroke-width': 1.2 }, svg);
        el('rect', { x: 413, y: 172, width: 30, height: 26, rx: 4, fill: '#8b96a0' }, svg);
        el('path', { d: 'M191 222 h28 M191 216 v12 M219 216 v12', stroke: '#9b5a08', 'stroke-width': 2, fill: 'none' }, svg);
        txt(svg, 205, 252, 'd', { 'font-size': 26, fill: '#9b5a08', 'text-anchor': 'middle', 'font-family': 'Fraunces, serif', 'font-style': 'italic' });
        [[60, 352, 6], [120, 352, 10], [185, 352, 14]].forEach(([x, y, r]) => ball(svg, x, y, r));
        txt(svg, 250, 360, 'r = d / 2', Object.assign({ 'font-size': 32, fill: '#2f6f8f' }, HAND));
        return svg;
      },
      function s2() {
        const svg = frame();
        tube(svg, { level: 70 });
        el('path', { d: 'M150 22 C 190 16 212 30 216 70', fill: 'none', stroke: '#e3b04b', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: .9 }, svg);
        el('path', { d: 'M70 40 l60 -30 l26 46 l-60 30 z', fill: 'rgba(255,255,255,.7)', stroke: '#9fa9b0', 'stroke-width': 2 }, svg);
        el('path', { d: 'M96 72 l50 -25 l10 9 l-60 30 z', fill: '#efc265' }, svg);
        const img = el('image', { href: 'assets/cylinder.png', x: 318, y: 120, width: 118, height: 226, preserveAspectRatio: 'xMidYMid meet' }, svg);
        img.setAttribute('aria-label', 'Measuring cylinder from the lab manual');
        el('rect', { x: 318, y: 120, width: 118, height: 226, rx: 8, fill: 'none', stroke: '#dcc89c' }, svg);
        txt(svg, 377, 372, 'lab manual', Object.assign({ 'font-size': 20, fill: '#7a6f5f', 'text-anchor': 'middle' }, HAND));
        txt(svg, 30, 260, 'glycerin', Object.assign({ 'font-size': 28, fill: '#9b5a08' }, HAND));
        return svg;
      },
      function s3() {
        const svg = frame(); tube(svg);
        // ruler
        el('rect', { x: 284, y: 30, width: 34, height: 340, fill: '#f3e6c4', stroke: '#c9b07a' }, svg);
        for (let c = 0; c <= 34; c++) { const y = 366 - c * 10; el('line', { x1: 284, y1: y, x2: 284 + (c % 5 ? 8 : 16), y2: y, stroke: '#6b5a3a', 'stroke-width': c % 5 ? .8 : 1.4 }, svg); }
        marks(svg, 96, 316);
        el('path', { d: 'M340 98 V314 M333 108 l7 -10 l7 10 M333 304 l7 10 l7 -10', stroke: '#9b5a08', 'stroke-width': 2, fill: 'none' }, svg);
        el('path', { d: 'M262 96 H346 M262 316 H346', stroke: '#9b5a08', 'stroke-width': 1, 'stroke-dasharray': '3 3' }, svg);
        txt(svg, 356, 216, 'D', { 'font-size': 32, fill: '#9b5a08', 'font-family': 'Fraunces, serif', 'font-style': 'italic' });
        txt(svg, 20, 66, 'a few cm below', Object.assign({ 'font-size': 22, fill: '#5d6872' }, HAND));
        txt(svg, 20, 88, 'the surface', Object.assign({ 'font-size': 22, fill: '#5d6872' }, HAND));
        txt(svg, 20, 350, 'above the base', Object.assign({ 'font-size': 22, fill: '#5d6872' }, HAND));
        return svg;
      },
      function s4() {
        const svg = frame(); tube(svg); marks(svg, 96, 316);
        ball(svg, 220, 50, 8);
        el('path', { d: 'M232 2 L224 40 M244 4 L228 42', stroke: '#5d6872', 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
        el('path', { d: 'M220 64 V84', stroke: '#2f6f8f', 'stroke-width': 2, 'stroke-dasharray': '3 4' }, svg);
        txt(svg, 290, 60, 'release at the', Object.assign({ 'font-size': 23, fill: '#2f6f8f' }, HAND));
        txt(svg, 290, 84, 'centre, gently', Object.assign({ 'font-size': 23, fill: '#2f6f8f' }, HAND));
        return svg;
      },
      function s5() {
        const svg = frame(); tube(svg); marks(svg, 96, 316);
        ball(svg, 220, 200, 8);
        el('path', { d: 'M220 112 V186', stroke: '#9b5a08', 'stroke-width': 1.5, 'stroke-dasharray': '2 5' }, svg);
        el('circle', { cx: 360, cy: 210, r: 54, fill: '#20262b' }, svg);
        el('rect', { x: 352, y: 144, width: 16, height: 14, rx: 3, fill: '#5d6872' }, svg);
        txt(svg, 360, 220, '2.78', { 'font-size': 30, fill: '#ffd77a', 'text-anchor': 'middle', 'font-family': 'Manrope, sans-serif', 'font-weight': 700 });
        txt(svg, 360, 244, 's', { 'font-size': 16, fill: '#c9a65a', 'text-anchor': 'middle', 'font-family': 'Manrope, sans-serif' });
        txt(svg, 20, 100, 'start ▸', Object.assign({ 'font-size': 26, fill: '#3e7d4b' }, HAND));
        txt(svg, 20, 320, 'stop ■', Object.assign({ 'font-size': 26, fill: '#b4442c' }, HAND));
        return svg;
      },
      function s6() {
        const svg = frame(); tube(svg); marks(svg, 96, 316);
        [[198, 290, 4], [220, 230, 6], [242, 160, 8]].forEach(([x, y, r]) => { el('path', { d: `M${x} 58 V${y - r - 4}`, stroke: '#8b96a0', 'stroke-width': 1.4, 'stroke-dasharray': '2 5' }, svg); ball(svg, x, y, r); });
        txt(svg, 290, 160, 'large: fastest', Object.assign({ 'font-size': 24, fill: '#5d6872' }, HAND));
        txt(svg, 290, 290, 'small: slowest', Object.assign({ 'font-size': 24, fill: '#5d6872' }, HAND));
        txt(svg, 290, 225, '(same moment)', Object.assign({ 'font-size': 20, fill: '#8b96a0' }, HAND));
        return svg;
      },
      function s7() {
        const svg = frame();
        el('rect', { x: 30, y: 60, width: 400, height: 200, rx: 12, fill: '#fff', stroke: '#dcc89c' }, svg);
        el('rect', { x: 30, y: 60, width: 400, height: 44, rx: 12, fill: '#f5ead1' }, svg);
        const cols = [70, 150, 240, 320, 395], heads = ['Ball', 'r', 'r²', 't', 'v = D/t'];
        heads.forEach((h, i) => txt(svg, cols[i], 89, h, { 'font-size': 17, 'font-weight': 700, fill: '#4a4237', 'text-anchor': 'middle', 'font-family': 'Manrope, sans-serif' }));
        LAB.balls.forEach((b, k) => {
          const y = 140 + k * 46;
          [b.n, b.r, b.r2, b.t, b.v].forEach((v, i) => txt(svg, cols[i], y, String(v), Object.assign({ 'font-size': 26, fill: i === 2 || i === 4 ? '#2f6f8f' : '#26313b', 'text-anchor': 'middle' }, HAND)));
        });
        txt(svg, 230, 310, 'r² = r × r', Object.assign({ 'font-size': 28, fill: '#9b5a08', 'text-anchor': 'middle' }, HAND));
        txt(svg, 230, 346, 'v = 30.0 / 2.78 = 10.79 cm/s', Object.assign({ 'font-size': 28, fill: '#9b5a08', 'text-anchor': 'middle' }, HAND));
        return svg;
      },
      function s8() {
        const svg = el('svg', { viewBox: '0 0 760 520', role: 'img' });
        const G = graphBase(svg, { small: true });
        G.line(svg, 0.002, 0.13);
        LAB.balls.forEach(b => G.pt(svg, b.r2, b.v));
        return svg;
      },
      function s9() {
        const svg = frame();
        txt(svg, 230, 110, 'η = ²⁄₉ (ρs − ρL) g × 1/S', { 'font-size': 30, fill: '#26313b', 'text-anchor': 'middle', 'font-family': 'Fraunces, serif' });
        el('rect', { x: 70, y: 150, width: 320, height: 66, rx: 14, fill: '#fde9bb', stroke: '#d4951f', 'stroke-width': 2 }, svg);
        txt(svg, 230, 194, 'g = 980 cm/s²', { 'font-size': 30, fill: '#7a4405', 'text-anchor': 'middle', 'font-family': 'Fraunces, serif', 'font-weight': 600 });
        txt(svg, 230, 280, '= ²⁄₉ × 6.6 × 980 / 120.0', Object.assign({ 'font-size': 30, fill: '#2f6f8f', 'text-anchor': 'middle' }, HAND));
        txt(svg, 230, 334, 'η = 11.98 poise', Object.assign({ 'font-size': 40, fill: '#3e7d4b', 'text-anchor': 'middle', 'font-weight': 700 }, HAND));
        return svg;
      }
    ];
    function show(k) {
      steps.forEach((b, i) => b.setAttribute('aria-pressed', i === k ? 'true' : 'false'));
      fig.innerHTML = ''; const svg = D[k](); svg.setAttribute('aria-label', 'Illustration of step ' + (k + 1)); fig.appendChild(svg);
      cap.textContent = CAPS[k];
    }
    steps.forEach((b, i) => b.addEventListener('click', () => show(i)));
    onEnter.method = () => { if (!fig.firstChild) show(0); };
  })();

  /* =====================================================================
     9. GRAPH PAPER — v (y) against r² (x)
     ===================================================================== */
  const GX = { x0: 112, x1: 728, y0: 62, y1: 440, xmax: 0.14, ymax: 16 };
  function graphBase(svg, opts) {
    opts = opts || {};
    svg.innerHTML = '';
    const X = x => GX.x0 + (x / GX.xmax) * (GX.x1 - GX.x0);
    const Y = y => GX.y1 - (y / GX.ymax) * (GX.y1 - GX.y0);
    const inv = (px, py) => [(px - GX.x0) / (GX.x1 - GX.x0) * GX.xmax, (GX.y1 - py) / (GX.y1 - GX.y0) * GX.ymax];
    const defs = el('defs', null, svg);
    const m = el('marker', { id: svg.id + '-ax', viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 8, markerHeight: 8, orient: 'auto' }, defs);
    el('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#4a4237' }, m);
    const grid = el('g', null, svg);
    el('rect', { x: GX.x0, y: GX.y0, width: GX.x1 - GX.x0, height: GX.y1 - GX.y0, fill: '#fffaf0' }, grid);
    for (let i = 0; i <= 56; i++) { const x = X(i * 0.0025); el('line', { x1: x, y1: GX.y0, x2: x, y2: GX.y1, stroke: i % 4 ? '#f1e3c2' : '#e2c98f', 'stroke-width': i % 4 ? .7 : 1.1 }, grid); }
    for (let j = 0; j <= 32; j++) { const y = Y(j * 0.5); el('line', { x1: GX.x0, y1: y, x2: GX.x1, y2: y, stroke: j % 4 ? '#f1e3c2' : '#e2c98f', 'stroke-width': j % 4 ? .7 : 1.1 }, grid); }
    el('line', { x1: GX.x0, y1: GX.y1, x2: GX.x1 + 14, y2: GX.y1, stroke: '#4a4237', 'stroke-width': 2, 'marker-end': `url(#${svg.id}-ax)` }, svg);
    el('line', { x1: GX.x0, y1: GX.y1, x2: GX.x0, y2: GX.y0 - 14, stroke: '#4a4237', 'stroke-width': 2, 'marker-end': `url(#${svg.id}-ax)` }, svg);
    const tl = el('g', { fill: '#4a4237', 'font-size': 17, 'font-family': 'Manrope, sans-serif' }, svg);
    for (let i = 0; i <= 7; i++) { const v = i * 0.02; txt(tl, X(v), GX.y1 + 26, i ? v.toFixed(2) : '0', { 'text-anchor': 'middle' }); el('line', { x1: X(v), y1: GX.y1, x2: X(v), y2: GX.y1 + 6, stroke: '#4a4237' }, svg); }
    for (let j = 1; j <= 8; j++) { const v = j * 2; txt(tl, GX.x0 - 12, Y(v) + 6, String(v), { 'text-anchor': 'end' }); el('line', { x1: GX.x0 - 6, y1: Y(v), x2: GX.x0, y2: Y(v), stroke: '#4a4237' }, svg); }
    txt(svg, GX.x0 - 6, 36, 'v (cm/s)', { class: 'hand', 'font-size': 34, fill: '#2f6f8f', 'text-anchor': 'middle', 'font-family': 'Caveat, cursive', 'font-weight': 700 });
    txt(svg, GX.x1 + 10, GX.y1 + 64, 'r² (cm²) →', { class: 'hand', 'font-size': 34, fill: '#2f6f8f', 'text-anchor': 'end', 'font-family': 'Caveat, cursive', 'font-weight': 700 });
    const layers = { line: el('g', null, svg), tri: el('g', null, svg), pts: el('g', null, svg), top: el('g', null, svg) };
    return {
      X, Y, inv, layers,
      line(parent, xa, xb, S, c) {
        S = S == null ? LAB.S : S; c = c == null ? 0 : c;
        return el('line', { x1: X(xa), y1: Y(S * xa + c), x2: X(xb), y2: Y(S * xb + c), stroke: '#2f6f8f', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, parent);
      },
      pt(parent, x, y, attrs) {
        const g = el('g', null, parent);
        el('circle', { cx: X(x), cy: Y(y), r: 7, fill: '#fff', stroke: '#9b5a08', 'stroke-width': 2.5 }, g);
        el('path', { d: `M${X(x) - 4} ${Y(y)} h8 M${X(x)} ${Y(y) - 4} v8`, stroke: '#9b5a08', 'stroke-width': 1.6 }, g);
        if (attrs) for (const k in attrs) g.setAttribute(k, attrs[k]);
        return g;
      }
    };
  }
  function slopeTriangle(G, parent, a, b, labels) {
    const [x1, y1] = a, [x2, y2] = b;
    const P1 = [G.X(x1), G.Y(y1)], P2 = [G.X(x2), G.Y(y2)];
    el('path', { d: `M${P1[0]} ${P1[1]} H${P2[0]} V${P2[1]}`, fill: 'rgba(233,178,74,.12)', stroke: '#9b5a08', 'stroke-width': 2, 'stroke-dasharray': '7 5' }, parent);
    const dx = x2 - x1, dy = y2 - y1;
    txt(parent, (P1[0] + P2[0]) / 2 + 30, Math.max(P1[1], P2[1]) + 34, `Δr² = ${trimNum(Math.abs(dx), 4)}`, { 'font-size': 28, fill: '#9b5a08', 'text-anchor': 'middle', 'font-family': 'Caveat, cursive', 'font-weight': 700 });
    const right = Math.max(P1[0], P2[0]);
    txt(parent, right + 12, (P1[1] + P2[1]) / 2 + 8, `Δv = ${trimNum(Math.abs(dy), 2)}`, { 'font-size': 28, fill: '#9b5a08', 'font-family': 'Caveat, cursive', 'font-weight': 700, 'text-anchor': right > 600 ? 'end' : 'start', dx: right > 600 ? -24 : 0 });
    if (labels) txt(parent, labels.x, labels.y, labels.s, { 'font-size': 32, fill: '#3e7d4b', 'font-family': 'Caveat, cursive', 'font-weight': 700 });
  }

  /* =====================================================================
     10. FORMULA EXPLORER
     ===================================================================== */
  (function formula() {
    const svg = $('forces-svg');
    const defs = el('defs', null, svg);
    [['fa1', '#9b5a08'], ['fa2', '#2f6f8f'], ['fa3', '#3e7d4b']].forEach(([id, c]) => { const m = el('marker', { id, viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, defs); el('path', { d: 'M0 0 L10 5 L0 10 z', fill: c }, m); });
    glassDefs(svg, 'fs');
    el('rect', { x: 20, y: 10, width: 220, height: 280, rx: 18, fill: '#fbe6b0', opacity: .7 }, svg);
    el('circle', { cx: 130, cy: 150, r: 30, fill: 'url(#fs-steel)' }, svg);
    el('line', { x1: 130, y1: 182, x2: 130, y2: 268, stroke: '#9b5a08', 'stroke-width': 4, 'marker-end': 'url(#fa1)' }, svg);
    el('line', { x1: 112, y1: 118, x2: 112, y2: 52, stroke: '#2f6f8f', 'stroke-width': 4, 'marker-end': 'url(#fa2)' }, svg);
    el('line', { x1: 148, y1: 118, x2: 148, y2: 38, stroke: '#3e7d4b', 'stroke-width': 4, 'marker-end': 'url(#fa3)' }, svg);
    txt(svg, 158, 74, '6πηrv', { 'font-size': 22, fill: '#3e7d4b', 'font-family': 'Fraunces, serif', 'font-style': 'italic' });
    txt(svg, 142, 262, 'weight', { 'font-size': 24, fill: '#9b5a08', 'font-family': 'Caveat, cursive', 'font-weight': 700 });
    txt(svg, 102, 62, 'upthrust', { 'font-size': 24, fill: '#2f6f8f', 'font-family': 'Caveat, cursive', 'font-weight': 700, 'text-anchor': 'end' });
    txt(svg, 158, 50, 'drag', { 'font-size': 24, fill: '#3e7d4b', 'font-family': 'Caveat, cursive', 'font-weight': 700 });

    const s = $('f-s'), rs = $('f-rs'), rl = $('f-rl');
    let g = 980;
    const gr = radioGroup('f-g', b => { g = +b.dataset.g; upd(); });
    function upd() {
      const S = +s.value, a = +rs.value, b = +rl.value;
      $('f-s-o').textContent = S.toFixed(2) + ' cm⁻¹ s⁻¹';
      $('f-rs-o').textContent = a.toFixed(2) + ' g/cm³';
      $('f-rl-o').textContent = b.toFixed(2) + ' g/cm³';
      const eta = (2 / 9) * (a - b) * g / S;
      $('f-line').innerHTML = `η = <sup>2</sup>⁄<sub>9</sub> × (${a.toFixed(2)} − ${b.toFixed(2)}) × <span class="g-hi">${g}</span> × <sup>1</sup>⁄<sub>${S.toFixed(2)}</sub>`;
      const res = $('f-result'); res.textContent = `η = ${eta < 1 ? eta.toFixed(4) : eta.toFixed(3)} P`;
      res.classList.toggle('bad', g !== 980);
      $('f-note').textContent = g !== 980
        ? 'g is still in m/s² while everything else is CGS, so this is 100 times too small.'
        : (a - b <= 0 ? 'With ρs ≤ ρL the sphere would not sink.' : `= ${(eta / 10).toFixed(4)} Pa·s. A steeper slope (faster fall for the same r²) means a less viscous liquid.`);
    }
    [s, rs, rl].forEach(i => i.addEventListener('input', upd));
    upd();
  })();

  /* =====================================================================
     11. OBSERVATION GRAPH (worked example)
     ===================================================================== */
  (function obsGraph() {
    const svg = $('obs-graph');
    const G = graphBase(svg);
    G.line(G.layers.line, 0.002, 0.128);
    slopeTriangle(G, G.layers.tri, [0.04, 4.79], [0.09, 10.79], { x: G.X(0.004), y: G.Y(14.6), s: 'S = 6.00 / 0.05 = 120.0' });
    const LP = [[-16, 8, 'end'], [-14, -14, 'end'], [14, 30, 'start']];
    LAB.balls.forEach((b, i) => {
      G.pt(G.layers.pts, b.r2, b.v);
      txt(G.layers.top, G.X(b.r2) + LP[i][0], G.Y(b.v) + LP[i][1], `(${b.r2}, ${b.v})`, { 'font-size': 25, fill: '#4a4237', 'font-family': 'Caveat, cursive', 'font-weight': 600, 'text-anchor': LP[i][2] });
    });
  })();

  /* =====================================================================
     12. MCQs
     ===================================================================== */
  const MCQ = [
    { q: 'What is the aim of this experiment?', a: "To determine the coefficient of viscosity of glycerin by Stokes' method", o: ['To measure the density of glycerin with a hydrometer', 'To find the surface tension of glycerin', 'To measure the speed of sound in glycerin'],
      hint: 'Look back at the first page.', ex: "The aim is to find η of glycerin by timing falling spheres (Stokes' method)." },
    { q: 'Viscosity is best described as a liquid’s…', a: 'internal friction, its resistance to flow', o: ['weight per unit volume', 'ability to conduct heat', 'tendency to evaporate'],
      hint: 'Think of layers sliding over each other.', ex: 'Viscosity is internal friction between layers of a flowing liquid.' },
    { q: 'What is the CGS unit of the coefficient of viscosity?', a: 'Poise', o: ['Pascal', 'Newton', 'Joule'],
      hint: 'It is named after Poiseuille.', ex: '1 poise = 1 g cm⁻¹ s⁻¹ = 0.1 Pa·s.' },
    { q: 'How many Pa·s is 1 poise?', a: '0.1 Pa·s', o: ['10 Pa·s', '1 Pa·s', '100 Pa·s'],
      hint: 'The SI unit is the larger one.', ex: '1 P = 0.1 Pa·s, so 11.98 P = 1.198 Pa·s.' },
    { q: 'When the falling sphere reaches terminal velocity…', a: 'the forces on it balance and it moves at constant speed', o: ['it stops moving', 'it keeps speeding up at g', 'the drag force becomes zero'],
      hint: 'Terminal velocity means no further change in speed.', ex: 'Weight = upthrust + viscous drag, so the net force is zero and the speed is constant.' },
    { q: "According to Stokes' law, the viscous drag on a sphere of radius r moving at speed v is…", a: '6πηrv', o: ['4/3 πr³ηv', '6πηr²v', 'ηv / r'],
      hint: 'See the derivation on the Formula page.', ex: "Stokes' drag F = 6πηrv grows with speed, which is why the sphere reaches a terminal velocity." },
    { q: 'Terminal velocity is proportional to…', a: 'r²', o: ['r', '1/r', 'r³'],
      hint: 'v = (2/9)(ρs − ρL) g r² / η', ex: 'v ∝ r², which is why the graph is v against r², not v against r.' },
    { q: 'In the graph for this experiment, what goes on the y-axis?', a: 'v (cm/s)', o: ['r² (cm²)', 't (s)', 'D (cm)'],
      hint: 'Method step 8.', ex: 'v on the y-axis, r² on the x-axis, so the slope S = Δv / Δr².' },
    { q: 'What is the correct expression for the slope S?', a: 'Δv / Δr²', o: ['Δr² / Δv', 'Δt / Δr', 'D / t'],
      hint: 'Rise over run: y change over x change.', ex: 'S = (v₂ − v₁)/(r₂² − r₁²). Swapping them (Δx/Δy) is a common slip.' },
    { q: 'In the formula η = (2/9)(ρs − ρL) g (1/S), what value of g should be used?', a: '980 cm/s²', o: ['9.8 m/s²', '9.8 cm/s²', '98 cm/s²'],
      hint: 'All other quantities are in cm, g and s.', ex: 'g = 9.8 m/s² × 100 cm/m = 980 cm/s², so the answer comes out in poise.' },
    { q: 'If g = 9.8 is used instead of 980 in the worked example, η comes out as…', a: '0.12 P, 100 times too small', o: ['1198 P, 100 times too large', '11.98 P, unchanged', '1.198 P, 10 times too small'],
      hint: '9.8 is 980 divided by 100.', ex: 'η is proportional to g, so using 9.8 instead of 980 gives 11.98 / 100 ≈ 0.12 P.' },
    { q: 'In the worked example, D = 30.0 cm and ball 3 took 2.78 s. Its velocity is…', a: '10.79 cm/s', o: ['83.4 cm/s', '0.093 cm/s', '30.0 cm/s'],
      hint: 'v = D / t.', ex: 'v = 30.0 / 2.78 = 10.79 cm/s.' },
    { q: 'A sphere has diameter 5.00 mm. What is r² in cm²?', a: '0.0625 cm²', o: ['0.25 cm²', '0.625 cm²', '6.25 cm²'],
      hint: 'Halve the diameter, change to cm, then square.', ex: 'd = 0.50 cm, so r = 0.25 cm and r² = 0.0625 cm².' },
    { q: 'Why is the upper mark X placed some distance below the liquid surface?', a: 'So the sphere has already reached terminal velocity before it is timed', o: ['So the marker ink does not touch the glycerin', 'Because glycerin is denser near the top', 'To make the measured time shorter'],
      hint: 'What is the sphere doing just after release?', ex: 'Just after release the sphere is still accelerating. By X it should be moving at constant speed.' },
    { q: 'Why should the two marks X and Y be far apart?', a: 'A longer time makes the reaction-time error a smaller percentage', o: ['The sphere slows down between them', 'It makes the glycerin less viscous', 'So the sphere hits the bottom sooner'],
      hint: 'The stopwatch error is about the same for any D.', ex: 'A ~0.1–0.2 s reaction error matters much less when t is long.' },
    { q: 'What happens to the viscosity of glycerin as it is warmed?', a: 'It decreases', o: ['It increases', 'It stays exactly the same', 'It first rises then falls'],
      hint: 'Warm honey pours more easily.', ex: 'Liquid viscosity falls sharply with temperature, so note the room temperature.' },
    { q: 'If the slope S of the v–r² graph is larger (everything else the same), the viscosity is…', a: 'smaller', o: ['larger', 'unchanged', 'zero'],
      hint: 'η = (2/9)(ρs − ρL) g / S.', ex: 'η ∝ 1/S: spheres falling faster mean a less viscous liquid.' },
    { q: 'Normal blood is roughly how viscous compared with water?', a: 'About 3–4 times more viscous', o: ['About the same', 'About 100 times more viscous', 'Less viscous than water'],
      hint: 'See the Medical perspectives page.', ex: 'Blood (≈ 0.03–0.04 P) is 3–4 times as viscous as water (≈ 0.01 P), mainly because of red cells.' },
    { q: 'Why can thicker (more viscous) blood contribute to hypertension?', a: 'The heart must push harder to keep the same flow', o: ['Thick blood lowers vessel resistance', 'Viscous blood carries less oxygen to the heart muscle only', 'It makes the vessels wider'],
      hint: 'Resistance R = 8ηL / πr⁴.', ex: 'Higher η raises flow resistance, so a higher pressure is needed for the same flow.' },
    { q: 'Through the same cannula, compared with normal saline, a more viscous IV fluid will…', a: 'flow more slowly', o: ['flow faster', 'flow at the same rate', 'not flow at all'],
      hint: 'Flow rate is inversely proportional to η.', ex: 'Blood products and albumin run slower than saline through the same line.' }
  ];
  (function mcq() {
    const list = $('mcq-list'), score = $('mcq-score');
    let solved = 0;
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function updScore() { score.textContent = `${solved} of ${MCQ.length} correct`; }
    function render() {
      solved = 0; list.innerHTML = '';
      MCQ.forEach((m, qi) => {
        const li = document.createElement('li'); li.className = 'mcq';
        const opts = shuffle([m.a].concat(m.o));
        li.innerHTML = `<p class="mcq-q"><span class="mcq-n">${qi + 1}.</span><span></span></p><div class="mcq-opts"></div><div class="mcq-fb" aria-live="polite"></div>`;
        li.querySelector('.mcq-q span:last-child').textContent = m.q;
        const box = li.querySelector('.mcq-opts'), fb = li.querySelector('.mcq-fb');
        opts.forEach(o => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.textContent = o;
          b.addEventListener('click', () => {
            if (li.classList.contains('solved')) return;
            if (o === m.a) {
              b.classList.remove('wrong'); b.classList.add('right'); li.classList.add('solved');
              box.querySelectorAll('.opt').forEach(x => { x.disabled = true; x.classList.remove('wrong'); });
              fb.className = 'mcq-fb show explain'; fb.textContent = m.ex;
              solved++; updScore();
            } else {
              b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
              fb.className = 'mcq-fb show hint'; fb.textContent = 'Not quite. ' + m.hint;
            }
          });
          box.appendChild(b);
        });
        list.appendChild(li);
      });
      updScore();
    }
    $('mcq-reset').addEventListener('click', render);
    render();
  })();

  /* =====================================================================
     13. PRACTICAL
     ===================================================================== */
  (function practical() {
    /* ---- terminal velocity (cm/s) from Stokes' law: v = (2/9)(ρs − ρL) g r² / η ---- */
    function vModel(r) { return (2 / 9) * (RHO_S - RHO_L) * G_CGS * r * r / ETA_GLY; }
    const TAU = 0.03;              // s: settling time to terminal velocity
    const SURFACE = 52, TOPCM = 56, PX = 12.8, YB = 742;
    const TX0 = 108, TX1 = 228;    // inner glass edges
    const RX = 252;                // ruler left edge
    const yOf = cm => YB - cm * PX;
    const cmOf = y => (YB - y) / PX;

    const svg = $('tube-svg');
    const st = { tool: null, marks: [], r: 0.2, ball: 1, mode: 'auto', run: null, rows: [], pick: [], line: null, slopeMode: 'pick', S: null, autoFilledS: false, swManual: { on: false, t0: 0, val: 0, started: false, stopped: false } };
    let seed = 1;

    /* ---- tube drawing ---- */
    glassDefs(svg, 'pt');
    const gBase = el('g', null, svg);
    el('rect', { x: TX0 - 40, y: YB + 4, width: TX1 - TX0 + 80, height: 16, rx: 8, fill: '#d8ccb1', stroke: '#b8a77f' }, gBase);
    el('rect', { x: TX0 - 26, y: YB - 2, width: TX1 - TX0 + 52, height: 8, rx: 3, fill: '#e6dcc4', stroke: '#b8a77f' }, gBase);
    el('path', { d: `M${TX0} ${yOf(SURFACE)} L${TX0} ${YB - 8} Q${TX0} ${YB} ${TX0 + 8} ${YB} L${TX1 - 8} ${YB} Q${TX1} ${YB} ${TX1} ${YB - 8} L${TX1} ${yOf(SURFACE)} Z`, fill: 'url(#pt-gly)' }, gBase);
    // slow drifting glints in the glycerin
    const glint = el('g', { opacity: .5 }, gBase);
    for (let k = 0; k < 7; k++) {
      const c = el('ellipse', { cx: TX0 + 18 + (k * 37) % (TX1 - TX0 - 30), cy: yOf(6 + k * 6.5), rx: 1.6, ry: 5, fill: '#fff' }, glint);
      if (!reduced) el('animate', { attributeName: 'cy', values: `${yOf(6 + k * 6.5)};${yOf(8 + k * 6.5)};${yOf(6 + k * 6.5)}`, dur: (14 + k * 3) + 's', repeatCount: 'indefinite' }, c);
    }
    el('ellipse', { cx: (TX0 + TX1) / 2, cy: yOf(SURFACE), rx: (TX1 - TX0) / 2, ry: 6, fill: '#f8e2ad', stroke: '#e0b860', 'stroke-width': 1 }, gBase);
    el('path', { d: `M${TX0} ${yOf(TOPCM)} L${TX0} ${YB - 8} Q${TX0} ${YB} ${TX0 + 8} ${YB} L${TX1 - 8} ${YB} Q${TX1} ${YB} ${TX1} ${YB - 8} L${TX1} ${yOf(TOPCM)}`, fill: 'url(#pt-glass)', stroke: '#97a2aa', 'stroke-width': 3 }, gBase);
    el('ellipse', { cx: (TX0 + TX1) / 2, cy: yOf(TOPCM), rx: (TX1 - TX0) / 2 + 4, ry: 6, fill: 'none', stroke: '#97a2aa', 'stroke-width': 3 }, gBase);
    el('rect', { x: TX0 + 10, y: yOf(TOPCM) + 16, width: 6, height: YB - yOf(TOPCM) - 40, rx: 3, fill: '#fff', opacity: .55 }, gBase);
    el('rect', { x: TX1 - 16, y: yOf(TOPCM) + 30, width: 3, height: YB - yOf(TOPCM) - 70, rx: 2, fill: '#fff', opacity: .35 }, gBase);
    txt(gBase, (TX0 + TX1) / 2, yOf(SURFACE) - 14, 'surface', { 'font-size': 20, fill: '#9b5a08', 'text-anchor': 'middle', 'font-family': 'Caveat, cursive', 'font-weight': 600 });
    // ruler (0–55 cm)
    const gR = el('g', null, svg);
    el('rect', { x: RX, y: yOf(55.6), width: 64, height: 55.6 * PX + 6, rx: 4, fill: '#f6e9c6', stroke: '#c9b07a' }, gR);
    for (let mm = 0; mm <= 550; mm++) {
      const y = yOf(mm / 10), long = mm % 10 === 0, mid = mm % 5 === 0;
      el('line', { x1: RX, y1: y, x2: RX + (long ? 18 : mid ? 12 : 6), y2: y, stroke: '#5e4d2c', 'stroke-width': long ? 1.3 : .6 }, gR);
      if (long && (mm / 10) % 5 === 0) txt(gR, RX + 24, y + 5, String(mm / 10), { 'font-size': 16, fill: '#4a3d22', 'font-weight': 700, 'font-family': 'Manrope, sans-serif' });
    }
    txt(gR, RX + 32, yOf(55.6) - 6, 'cm', { 'font-size': 14, fill: '#7a6a48', 'text-anchor': 'middle' });
    const gGuide = el('g', null, svg), gMarks = el('g', null, svg), gLabels = el('g', null, svg);
    const gD = el('g', null, svg);
    const hit = el('rect', { x: TX0 - 14, y: yOf(TOPCM) - 6, width: TX1 - TX0 + 28, height: YB - yOf(TOPCM) + 6, fill: 'transparent', class: 'tube-hit' }, svg);
    const gDish = el('g', null, svg), gSph = el('g', null, svg), gMag = el('g', null, svg);
    const ghost = el('path', { d: '', stroke: '#26313b', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', opacity: .9 }, gMarks);

    /* ---- marks ---- */
    function sortedMarks() { return st.marks.slice().sort((a, b) => b.cm - a.cm); }
    function getXY() { const m = sortedMarks(); return m.length === 2 ? { X: m[0], Y: m[1], D: m[0].cm - m[1].cm } : null; }
    function renderMarks() {
      gMarks.querySelectorAll('.mark').forEach(n => n.remove());
      gLabels.innerHTML = ''; gGuide.innerHTML = ''; gD.innerHTML = '';
      const sm = sortedMarks();
      sm.forEach((m, i) => {
        const y = yOf(m.cm);
        const p = el('path', { d: handMark(TX0 - 3, TX0 - 3 + (TX1 - TX0 + 6) * m.len, y, m.seed, 1.0), class: 'mark', stroke: '#26313b', 'stroke-width': 3.2, fill: 'none', 'stroke-linecap': 'round', opacity: m.ink.toFixed(2) }, gMarks);
        p.dataset.id = m.id;
        el('line', { x1: TX1 + 4, y1: y, x2: RX, y2: y, stroke: '#2f6f8f', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: m.ink }, gGuide);
        const lab = sm.length === 2 ? (i === 0 ? 'X' : 'Y') : '';
        if (lab) txt(gLabels, TX0 - 20, y + 9, lab, { 'font-size': 32, fill: '#2f6f8f', 'text-anchor': 'end', 'font-family': 'Caveat, cursive', 'font-weight': 700, opacity: m.ink });
        txt(gLabels, TX0 - 16, y + (lab ? 32 : 7), m.cm.toFixed(1) + ' cm', { 'font-size': 23, fill: '#4a4237', 'text-anchor': 'end', 'font-family': 'Caveat, cursive', 'font-weight': 600, opacity: m.ink });
      });
      const xy = getXY();
      if (xy) {
        const xa = RX + 74, y1 = yOf(xy.X.cm), y2 = yOf(xy.Y.cm);
        el('path', { d: `M${xa} ${y1 + 2} V${y2 - 2} M${xa - 6} ${y1 + 11} l6 -9 l6 9 M${xa - 6} ${y2 - 11} l6 9 l6 -9`, stroke: '#9b5a08', 'stroke-width': 2, fill: 'none' }, gD);
        txt(gD, xa + 4, (y1 + y2) / 2 + 10, 'D', { 'font-size': 28, fill: '#9b5a08', 'font-family': 'Fraunces, serif', 'font-style': 'italic', 'text-anchor': 'start', dx: 6 });
      }
      updateD();
    }
    function updateD() {
      const xy = getXY();
      $('d-val').textContent = xy ? xy.D.toFixed(1) + ' cm' : '—';
      $('tbl-d').textContent = xy ? xy.D.toFixed(1) + ' cm' : '—';
      const msg = $('tube-msg');
      let cls = '', s;
      if (st.marks.length === 0) s = 'Pick the marker and draw two lines across the tube.';
      else if (st.marks.length === 1) s = 'One mark drawn. Draw a second line lower down.';
      else {
        const below = SURFACE - xy.X.cm;
        if (below < 6) { cls = 'warn'; s = `X is only ${below.toFixed(1)} cm below the surface. The sphere is still speeding up there; move X lower so it has reached terminal velocity before timing starts.`; }
        else if (xy.D < 15) { cls = 'warn'; s = `The marks are only ${xy.D.toFixed(1)} cm apart. The fall takes a fraction of a second, so a 0.1–0.2 s reaction error is a large percentage of t. Spread them further apart.`; }
        else if (xy.Y.cm < 3) { cls = 'warn'; s = 'Y is very close to the base, where the bottom of the cylinder slows the sphere. Move Y a little higher.'; }
        else { cls = 'ok'; s = `Good: X is ${below.toFixed(1)} cm below the surface and D = ${xy.D.toFixed(1)} cm. Drag a mark to adjust it.`; }
      }
      msg.className = 'tube-msg' + (cls ? ' ' + cls : ''); msg.textContent = s;
      // changing D invalidates earlier readings
      if (st.rows.length && st.rowsD != null && (!xy || Math.abs(xy.D - st.rowsD) > 1e-9)) {
        clearRows(); $('sw-msg').textContent = 'D changed, so the earlier readings were cleared.';
      }
    }
    const snap = cm => Math.round(cm * 2) / 2;
    const clampCm = cm => clamp(cm, 1, SURFACE - 0.5);
    function markNear(cm, tol) {
      let best = null, bd = tol;
      st.marks.forEach(m => { const d = Math.abs(m.cm - cm); if (d <= bd) { bd = d; best = m; } });
      return best;
    }
    /* ---- tools ---- */
    function setTool(t) {
      st.tool = st.tool === t ? null : t;
      $('tool-marker').setAttribute('aria-pressed', st.tool === 'marker');
      $('tool-eraser').setAttribute('aria-pressed', st.tool === 'eraser');
      setCursorTool(st.tool);
    }
    $('tool-marker').addEventListener('click', () => setTool('marker'));
    $('tool-eraser').addEventListener('click', () => setTool('eraser'));
    onLeave.practical = () => { setCursorTool(null); abortRun(); };
    onEnter.practical = () => setCursorTool(st.tool);

    let drag = null;
    function busyMsg() { $('tube-msg').className = 'tube-msg warn'; $('tube-msg').textContent = 'Wait for the sphere to reach the bottom before changing the marks.'; }
    hit.addEventListener('pointerdown', e => {
      e.preventDefault();
      const p = svgPoint(svg, e), cm = cmOf(p.y);
      const near = markNear(cm, 8 / PX);
      if (st.run && (st.tool || near)) { busyMsg(); return; }
      hit.setPointerCapture(e.pointerId);
      if (st.tool === 'eraser') {
        drag = { kind: 'erase', x: p.x, y: p.y, moved: 0, target: markNear(cm, 12 / PX) };
        return;
      }
      if (near) { drag = { kind: 'move', m: near, off: near.cm - cm }; return; }
      if (st.tool === 'marker') {
        if (st.marks.length >= 2) { $('tube-msg').className = 'tube-msg warn'; $('tube-msg').textContent = 'Two marks are enough. Drag one to move it, or erase one first.'; return; }
        const c = snap(clampCm(cm));
        if (markNear(c, 1)) { $('tube-msg').className = 'tube-msg warn'; $('tube-msg').textContent = 'Too close to the other mark. Draw it further away.'; return; }
        seed = (seed * 7 + 13) % 97 + 1;
        drag = { kind: 'draw', cm: c, x0: clamp(p.x, TX0 - 3, TX1 + 3), x: p.x, seed };
        drawGhost();
        return;
      }
      $('tube-msg').className = 'tube-msg'; $('tube-msg').textContent = 'Pick the marker to draw a line, or the eraser to remove one.';
    });
    function drawGhost() {
      const a = Math.min(drag.x0, clamp(drag.x, TX0 - 3, TX1 + 3)), b = Math.max(drag.x0, clamp(drag.x, TX0 - 3, TX1 + 3));
      ghost.setAttribute('d', b - a < 2 ? '' : handMark(a, b, yOf(drag.cm), drag.seed, 1.0));
    }
    hit.addEventListener('pointermove', e => {
      if (!drag) return;
      const p = svgPoint(svg, e), cm = cmOf(p.y);
      if (drag.kind === 'draw') { drag.x = p.x; drawGhost(); }
      else if (drag.kind === 'move') {
        const c = snap(clampCm(cm + drag.off));
        const other = st.marks.find(m => m !== drag.m);
        if (other && Math.abs(other.cm - c) < 1) return;
        if (c !== drag.m.cm) { drag.m.cm = c; renderMarks(); }
      } else if (drag.kind === 'erase') {
        const dist = Math.hypot(p.x - drag.x, p.y - drag.y); drag.moved += dist; drag.x = p.x; drag.y = p.y;
        const m = markNear(cm, 12 / PX);
        if (m) { m.ink -= dist / 110; if (m.ink <= 0.12) removeMark(m); else renderMarks(); }
      }
    });
    function endDrag() {
      if (!drag) return;
      if (drag.kind === 'draw') {
        ghost.setAttribute('d', '');
        const m = { id: Date.now() + Math.random(), cm: drag.cm, seed: drag.seed, ink: 1, len: 1 };
        st.marks.push(m); renderMarks();
      } else if (drag.kind === 'erase' && drag.moved < 5 && drag.target && st.marks.includes(drag.target)) removeMark(drag.target);
      drag = null;
    }
    function removeMark(m) { st.marks = st.marks.filter(x => x !== m); renderMarks(); }
    hit.addEventListener('pointerup', endDrag);
    hit.addEventListener('pointercancel', endDrag);
    hit.addEventListener('pointermove', e => {
      if (drag) return;
      const near = markNear(cmOf(svgPoint(svg, e).y), 8 / PX);
      hit.style.cursor = near ? 'ns-resize' : '';
    });

    /* ---- micrometer ---- */
    const micro = $('micro-svg'), microRange = $('micro-d');
    function drawMicro(dmm) {
      micro.innerHTML = '';
      const x0 = 70, k = 22, yI = 62;
      // frame + anvil + spindle
      el('path', { d: 'M18 22 h22 v80 h-22 z', fill: '#8b96a0' }, micro);
      el('rect', { x: 40, y: 54, width: 10, height: 16, fill: '#c3cad0', stroke: '#5d6872' }, micro);
      const ballR = clamp(dmm * 2.4, 3, 18);
      el('circle', { cx: 50 + ballR, cy: yI, r: ballR, fill: 'url(#pt-steel)' }, micro);
      const xs = x0 + dmm * k;
      el('rect', { x: 50 + ballR * 2, y: 56, width: Math.max(0, xs - 50 - ballR * 2 - 2), height: 12, fill: '#d6dbe0', stroke: '#8b96a0' }, micro);
      // sleeve
      el('rect', { x: xs - 2, y: 44, width: 400 - xs, height: 36, fill: '#e4e8eb', stroke: '#8b96a0' }, micro);
      el('line', { x1: xs, y1: yI, x2: 400, y2: yI, stroke: '#26313b', 'stroke-width': 1.2 }, micro);
      // thimble (covers the sleeve beyond the reading)
      el('rect', { x: xs, y: 30, width: 400 - xs, height: 64, rx: 6, fill: '#aab3bb', stroke: '#5d6872' }, micro);
      // thimble divisions
      const thim = Math.round((dmm * 100) % 50);
      for (let j = -4; j <= 4; j++) {
        const v = ((thim + j) % 50 + 50) % 50, y = yI - j * 7;
        el('line', { x1: xs, y1: y, x2: xs + (v % 5 ? 8 : 14), y2: y, stroke: '#26313b', 'stroke-width': v % 5 ? 1 : 1.5 }, micro);
        if (v % 5 === 0) txt(micro, xs + 18, y + 4, String(v), { 'font-size': 11, fill: '#26313b' });
      }
      el('path', { d: `M${xs - 2} ${yI} h-1`, stroke: '#b4442c' }, micro);
      // visible sleeve scale: draw behind thimble => only to the left of xs
      for (let mm = 0; mm * k + x0 <= xs + 0.5 && mm <= 8; mm++) {
        const x = x0 + mm * k;
        el('line', { x1: x, y1: yI, x2: x, y2: yI - 10, stroke: '#26313b', 'stroke-width': 1.2 }, micro);
        txt(micro, x, yI - 14, String(mm), { 'font-size': 11, fill: '#26313b', 'text-anchor': 'middle' });
        if (x + k / 2 <= xs + 0.5) el('line', { x1: x + k / 2, y1: yI, x2: x + k / 2, y2: yI + 7, stroke: '#26313b', 'stroke-width': 1 }, micro);
      }
      el('rect', { x: 400, y: 46, width: 16, height: 32, rx: 4, fill: '#8b96a0' }, micro);
      const main = Math.floor(dmm * 2 + 1e-9) / 2, th = Math.round((dmm - main) * 100);
      $('micro-read').innerHTML = `Main scale ${main.toFixed(1)} mm + thimble ${th} × 0.01 mm = <b>d = ${dmm.toFixed(2)} mm</b> → r = ${(dmm / 20).toFixed(dmm * 100 % 2 ? 4 : 3).replace(/0+$/, '').replace(/\.$/, '')} cm`;
    }
    /* ---- spheres in numbered dishes, tweezers drag-and-drop, bar magnet ---- */
    const rvOf = r => 3 + r * PX * 2.8;
    const DISH = { '1': [-100, 140], '2': [-52, 140], '3': [-4, 140], 'C': [-52, 236] };
    const dishEls = {};
    txt(gDish, -52, 86, 'steel spheres', { 'font-size': 22, fill: '#5d6872', 'text-anchor': 'middle', 'font-family': 'Caveat, cursive', 'font-weight': 600 });
    Object.keys(DISH).forEach(k => {
      const [cx, cy] = DISH[k];
      const g = el('g', { class: 'dish' + (k === 'C' ? ' dish-c' : '') }, gDish);
      el('ellipse', { cx, cy: cy + 11, rx: 24, ry: 4.5, fill: 'rgba(80,60,20,.12)' }, g);
      el('path', { d: `M${cx - 22} ${cy} Q${cx} ${cy + 19} ${cx + 22} ${cy}`, fill: '#e9edf0', stroke: '#9fa9b0', 'stroke-width': 1.5 }, g);
      const rim = el('ellipse', { cx, cy, rx: 22, ry: 5, fill: '#f6f8f9', stroke: '#9fa9b0', 'stroke-width': 1.5 }, g);
      txt(g, cx, cy + 40, k === 'C' ? 'custom' : k, { 'font-size': k === 'C' ? 20 : 22, fill: '#4a4237', 'text-anchor': 'middle', 'font-family': k === 'C' ? 'Caveat, cursive' : 'Manrope, sans-serif', 'font-weight': 700 });
      dishEls[k] = { g, rim };
    });
    // drop zone above the glycerin
    const dropZone = el('g', { opacity: 0, 'pointer-events': 'none' }, gDish);
    el('rect', { x: TX0 + 2, y: yOf(TOPCM) - 40, width: TX1 - TX0 - 4, height: yOf(SURFACE) - yOf(TOPCM) + 44, rx: 8, fill: 'rgba(233,178,74,.14)', stroke: '#d4951f', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, dropZone);
    txt(dropZone, (TX0 + TX1) / 2, yOf(TOPCM) - 12, 'release here', { 'font-size': 20, fill: '#9b5a08', 'text-anchor': 'middle', 'font-family': 'Caveat, cursive', 'font-weight': 700 });

    const spheres = ['1', '2', '3', 'C'].map(k => {
      const sp = { key: k, r: k === 'C' ? +microRange.value / 20 : LAB.balls[+k - 1].r, state: 'dish', x: 0, y: 0, anim: null };
      sp.el = el('circle', { fill: 'url(#pt-steel)', stroke: '#3d464e', 'stroke-width': .6, class: 'sphere' }, gSph);
      sp.el.addEventListener('pointerdown', e => grab(sp, e));
      return sp;
    });
    const spByKey = k => spheres.find(s => s.key === String(k));
    let customShown = false;
    function toDish(sp) { const [cx, cy] = DISH[sp.key]; sp.x = cx; sp.y = cy + 3 - rvOf(sp.r); }
    function renderSphere(sp) {
      sp.el.setAttribute('cx', sp.x.toFixed(2)); sp.el.setAttribute('cy', sp.y.toFixed(2)); sp.el.setAttribute('r', rvOf(sp.r).toFixed(2));
      const hidden = sp.key === 'C' && sp.state === 'dish' && !customShown;
      sp.el.style.display = hidden ? 'none' : '';
      sp.el.style.pointerEvents = sp.state === 'dish' ? 'auto' : 'none';
      sp.el.classList.toggle('pt-hit', sp.state === 'dish');
    }
    function renderDishes() {
      dishEls.C.g.style.display = customShown || spByKey('C').state !== 'dish' ? '' : 'none';
      Object.keys(dishEls).forEach(k => {
        const sel = String(st.ball) === k;
        dishEls[k].rim.setAttribute('stroke', sel ? '#d4951f' : '#9fa9b0');
        dishEls[k].rim.setAttribute('stroke-width', sel ? 2.6 : 1.5);
      });
    }
    function sphMsg(s) { $('sw-msg').textContent = s; }
    const dishName = k => k === 'C' ? 'the custom dish' : 'dish ' + k;

    function applyPick(b) {
      const custom = b.dataset.r === 'custom';
      $('micro-ctl').hidden = !custom;
      customShown = custom || spByKey('C').state !== 'dish';
      if (custom) { st.ball = 'C'; st.r = +microRange.value / 20; const c = spByKey('C'); if (c.state === 'dish') { c.r = st.r; toDish(c); } }
      else { st.ball = ballPick.btns.indexOf(b) + 1; st.r = +b.dataset.r; microRange.value = (st.r * 20).toFixed(2); }
      $('micro-d-o').textContent = (st.r * 20).toFixed(2) + ' mm';
      drawMicro(st.r * 20); spheres.forEach(renderSphere); renderDishes();
    }
    const ballPick = radioGroup('ball-pick', applyPick);
    function selectKey(k) { const b = ballPick.btns[k === 'C' ? 3 : +k - 1]; ballPick.set(b); applyPick(b); }
    microRange.addEventListener('input', () => {
      st.r = +microRange.value / 20; $('micro-d-o').textContent = (+microRange.value).toFixed(2) + ' mm'; drawMicro(+microRange.value);
      const c = spByKey('C');
      if (c.state === 'dish') { c.r = st.r; toDish(c); renderSphere(c); } else sphMsg('The custom sphere is in the tube. Lift it out with the magnet before measuring a new size.');
    });

    /* tweezers: drag a sphere from its dish and release it above the surface */
    const inDropZone = p => p.x > TX0 - 6 && p.x < TX1 + 6 && p.y > yOf(TOPCM) - 60 && p.y < yOf(SURFACE) + 8;
    function dishAt(p) { return Object.keys(DISH).find(k => (k !== 'C' || customShown) && Math.hypot(p.x - DISH[k][0], p.y - DISH[k][1]) < 28); }
    function grab(sp, e) {
      if (sp.state !== 'dish') return;
      e.preventDefault(); e.stopPropagation();
      selectKey(sp.key);
      sp.state = 'held'; renderSphere(sp);
      setCursorTool('tweezers'); dropZone.setAttribute('opacity', 1);
      const mv = ev => { const p = svgPoint(svg, ev); sp.x = clamp(p.x, -120, 355); sp.y = clamp(p.y, 10, 790); renderSphere(sp); };
      const up = ev => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        dropZone.setAttribute('opacity', 0); setCursorTool(st.tool);
        const p = svgPoint(svg, ev);
        if (inDropZone(p) && tryDrop(sp, p.x)) return;
        const d = dishAt(p);
        if (d && d !== sp.key) sphMsg(`This ball belongs in ${dishName(sp.key)}.`);
        else if (!inDropZone(p) && !d) sphMsg('Release the sphere just above the glycerin at the top of the tube.');
        startReturn(sp);
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    }

    /* timed fall */
    const swVal = $('sw-val'), swBox = $('stopwatch');
    function swShow(t, running) { swVal.textContent = t.toFixed(2); swBox.classList.toggle('running', !!running); }
    radioGroup('sw-mode', b => { st.mode = b.dataset.mode; $('btn-sw').hidden = st.mode !== 'manual'; sphMsg(st.mode === 'manual' ? 'Press Start / stop (or Space) as the sphere passes X, and again at Y.' : 'The watch starts at X and stops at Y by itself.'); });
    function land(sp) {
      const rv = rvOf(sp.r), lo = TX0 + rv + 3, hi = TX1 - rv - 3;
      const others = spheres.filter(o => o !== sp && o.state === 'bottom');
      const free = x => others.every(o => Math.abs(o.x - x) >= rv + rvOf(o.r) + 1);
      let x = clamp(sp.x, lo, hi);
      for (let k = 0; k < 60 && !free(x); k++) { const c = clamp(sp.x + (k % 2 ? 1 : -1) * Math.ceil((k + 1) / 2) * 3, lo, hi); if (free(c)) { x = c; break; } }
      sp.x = x; sp.y = YB - rv - 1; sp.state = 'bottom'; renderSphere(sp);
    }
    function tryDrop(sp, x) {
      const xy = getXY();
      if (!xy) { sphMsg('Draw two marks (X and Y) on the tube first.'); return false; }
      if (st.run) { sphMsg('Wait until the falling sphere reaches the bottom.'); return false; }
      const rv = rvOf(sp.r);
      sp.state = 'falling'; sp.x = clamp(x, TX0 + rv + 4, TX1 - rv - 4); sp.y = yOf(SURFACE); renderSphere(sp);
      const vT = vModel(sp.r);
      const sX = SURFACE - xy.X.cm, sY = SURFACE - xy.Y.cm, sBot = SURFACE - (rv + 1) / PX;
      const slow = $('slowmo').checked ? 0.25 : 1;
      const run = { sp, s: 0, v: 0, t: 0, tX: null, tY: null, last: performance.now(), xy, vT, slow, r: sp.r, ball: sp.key === 'C' ? 'C' : +sp.key, done: false, bottomAt: null };
      st.run = run; $('btn-drop').disabled = true;
      st.swManual = { on: false, t0: 0, val: 0, started: false, stopped: false };
      swShow(0, false);
      sphMsg(st.mode === 'auto' ? 'Sphere released…' : 'Sphere released. Time it from X to Y.');
      function step(now) {
        if (st.run !== run) return;
        const dtReal = Math.min(0.05, (now - run.last) / 1000); run.last = now;
        let dt = dtReal * slow;
        const sub = 1 / 2000;
        while (dt > 1e-9 && !run.done) {
          const h = Math.min(sub, dt); dt -= h;
          const height = SURFACE - run.s;
          const vEff = run.vT * (height < 3 ? 0.55 + 0.45 * Math.max(0, height) / 3 : 1);
          run.v += (vEff - run.v) * (1 - Math.exp(-h / TAU));
          const s0 = run.s; run.s += run.v * h; run.t += h;
          if (run.tX == null && s0 < sX && run.s >= sX) run.tX = run.t - h * (run.s - sX) / (run.s - s0);
          if (run.tY == null && s0 < sY && run.s >= sY) run.tY = run.t - h * (run.s - sY) / (run.s - s0);
          if (run.s >= sBot) { run.s = sBot; run.done = true; }
        }
        sp.y = yOf(SURFACE - run.s); renderSphere(sp);
        if (st.mode === 'auto') {
          if (run.tX != null && run.tY == null) swShow(run.t - run.tX, true);
          if (run.tY != null && !run.recorded) { run.recorded = true; const t = Math.round((run.tY - run.tX) * 100) / 100; swShow(t, false); record(run, t); }
        } else {
          const m = st.swManual; if (m.on) { m.val = run.t - m.t0; swShow(m.val, true); }
        }
        if (run.done) {
          if (run.bottomAt == null) { run.bottomAt = now; land(sp); }
          if (st.mode === 'manual' && st.swManual.on && now - run.bottomAt < 1500) { run.raf = requestAnimationFrame(step); return; }
          if (st.mode === 'manual') {
            const m = st.swManual;
            if (m.on) { m.on = false; swShow(m.val, false); sphMsg('The watch was still running after the sphere reached the bottom. Lift it out with the magnet and drop it again.'); }
            else if (!m.stopped) sphMsg('No time was taken. Lift the sphere out with the magnet and drop it again, pressing Start / stop at X and at Y.');
          }
          st.run = null; $('btn-drop').disabled = false;
          return;
        }
        run.raf = requestAnimationFrame(step);
      }
      run.raf = requestAnimationFrame(step);
      return true;
    }
    function abortRun() {
      if (!st.run) return;
      cancelAnimationFrame(st.run.raf); const sp = st.run.sp; st.run = null;
      land(sp); $('btn-drop').disabled = false;
    }
    $('btn-drop').addEventListener('click', () => {
      const sp = spByKey(st.ball);
      if (sp.state !== 'dish') { sphMsg('This sphere is in the tube. Lift it out with the magnet first.'); return; }
      if (tryDrop(sp, (TX0 + TX1) / 2)) renderDishes();
    });

    /* bar magnet: drag it along the outside of the glass to lift a sphere */
    const MX = TX0 - 12, PARK = [-52, 630], MH = 38;
    const mag = { x: PARK[0], y: PARK[1], onTrack: false, drag: false, held: null };
    const gMagEl = el('g', { class: 'magnet pt-hit', style: 'touch-action:none' }, gMag);
    el('rect', { x: -14, y: -MH - 6, width: 28, height: MH * 2 + 12, fill: 'transparent' }, gMagEl);
    const mdefs = el('defs', null, svg);
    const mg = el('linearGradient', { id: 'mag-black', x1: 0, x2: 1, y1: 0, y2: 0 }, mdefs);
    [['0', '#1b1d1f'], ['.3', '#3a3d40'], ['.45', '#2a2c2e'], ['1', '#121314']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, mg));
    el('rect', { x: -9, y: -MH, width: 18, height: MH * 2, rx: 3, fill: 'url(#mag-black)', stroke: '#0c0d0e', 'stroke-width': 1.2 }, gMagEl);
    el('rect', { x: -5.5, y: -MH + 4, width: 2.2, height: MH * 2 - 8, rx: 1.1, fill: '#fff', opacity: .12 }, gMagEl);
    el('line', { x1: -9, y1: 0, x2: 9, y2: 0, stroke: '#4a4d50', 'stroke-width': .8, opacity: .6 }, gMagEl);
    txt(gMagEl, 0, -MH + 16, 'N', { 'font-size': 11, fill: '#c9ced3', opacity: .55, 'text-anchor': 'middle', 'font-weight': 600, 'font-family': 'Manrope, sans-serif' });
    txt(gMagEl, 0, MH - 7, 'S', { 'font-size': 11, fill: '#c9ced3', opacity: .55, 'text-anchor': 'middle', 'font-weight': 600, 'font-family': 'Manrope, sans-serif' });
    txt(gDish, PARK[0], PARK[1] + MH + 32, 'Magnet', { 'font-size': 22, fill: '#5d6872', 'text-anchor': 'middle', 'font-family': 'Caveat, cursive', 'font-weight': 600 });
    function renderMag() { gMagEl.setAttribute('transform', `translate(${mag.x.toFixed(1)} ${mag.y.toFixed(1)})`); }
    gMagEl.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const p0 = svgPoint(svg, e), off = mag.y - p0.y;
      mag.drag = true; setCursorTool('magnet'); kick();
      const mv = ev => {
        const p = svgPoint(svg, ev);
        if (p.x > 40 && p.x < TX1) { mag.onTrack = true; mag.x = MX; mag.y = clamp(p.y + off, MH + 4, YB - MH + 4); }
        else { mag.onTrack = false; mag.x = clamp(p.x, -110, 40); mag.y = clamp(p.y + off, MH + 4, 790 - MH); }
        renderMag(); kick();
      };
      const up = () => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        mag.drag = false; setCursorTool(st.tool);
        if (!mag.onTrack) { mag.x = PARK[0]; mag.y = PARK[1]; }
        renderMag(); kick();
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    function parkMagnet() { mag.x = PARK[0]; mag.y = PARK[1]; mag.onTrack = false; mag.held = null; renderMag(); }

    function startReturn(sp) {
      const [dx, dy] = DISH[sp.key];
      sp.state = 'returning';
      sp.anim = { t: 0, x0: sp.x, y0: sp.y, x1: dx, y1: dy + 3 - rvOf(sp.r), cx: (sp.x + dx) / 2, cy: Math.min(sp.y, dy) - 70 };
      renderSphere(sp); kick();
    }
    let ticking = false, lastT = 0;
    function kick() { if (!ticking) { ticking = true; lastT = performance.now(); requestAnimationFrame(tick); } }
    function tick(now) {
      const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      // the magnet grips the nearest sphere resting (or sinking) in the tube
      if (mag.onTrack && !mag.held) {
        let best = null, bd = 95;
        spheres.forEach(sp => { if (sp.state === 'bottom' || sp.state === 'sinking') { const d = Math.hypot(sp.x - MX, sp.y - mag.y); if (d < bd) { bd = d; best = sp; } } });
        if (best) { mag.held = best; best.state = 'lifting'; sphMsg('The magnet has caught the sphere. Slide it slowly up the glass.'); }
      }
      if (mag.held && !mag.onTrack) { mag.held.state = 'sinking'; mag.held = null; }
      spheres.forEach(sp => {
        if (sp.state === 'lifting') {
          const rv = rvOf(sp.r), inLiquid = sp.y > yOf(SURFACE) - rv;
          const maxV = inLiquid ? 115 : 450;                     // px/s: viscous drag keeps it slow in glycerin
          const vy = clamp((mag.y - sp.y) * 2.2, -maxV, maxV);
          sp.y = Math.min(YB - rv - 1, sp.y + vy * dt);
          sp.x += (TX0 + rv + 3 - sp.x) * Math.min(1, dt * 2.5);
          if (sp.y < yOf(SURFACE) - rv - 2) { mag.held = null; startReturn(sp); sphMsg(`Sphere lifted out and returned to ${dishName(sp.key)}.`); }
          renderSphere(sp);
        } else if (sp.state === 'sinking') {
          sp.y += vModel(sp.r) * PX * dt;
          if (sp.y >= YB - rvOf(sp.r) - 1) land(sp); else renderSphere(sp);
        } else if (sp.state === 'returning') {
          const a = sp.anim; a.t = Math.min(1, a.t + dt / 0.6);
          const u = a.t, w = 1 - u;
          sp.x = w * w * a.x0 + 2 * w * u * a.cx + u * u * a.x1; sp.y = w * w * a.y0 + 2 * w * u * a.cy + u * u * a.y1;
          if (u >= 1) { sp.state = 'dish'; sp.anim = null; toDish(sp); if (sp.key === 'C') { sp.r = +microRange.value / 20; toDish(sp); customShown = st.ball === 'C'; renderDishes(); } }
          renderSphere(sp);
        }
      });
      const busy = mag.drag || mag.held || spheres.some(sp => sp.state === 'lifting' || sp.state === 'sinking' || sp.state === 'returning');
      if (busy) requestAnimationFrame(tick); else ticking = false;
    }
    function resetSpheres() {
      if (st.run) { cancelAnimationFrame(st.run.raf); st.run = null; $('btn-drop').disabled = false; }
      parkMagnet();
      spheres.forEach(sp => { sp.state = 'dish'; sp.anim = null; if (sp.key === 'C') sp.r = +microRange.value / 20; toDish(sp); });
      customShown = st.ball === 'C';
      spheres.forEach(renderSphere); renderDishes();
    }
    function manualPress() {
      const run = st.run, m = st.swManual;
      if (st.mode !== 'manual') return;
      if (!run) { $('sw-msg').textContent = 'Release the sphere first.'; return; }
      if (!m.started) { m.started = true; m.on = true; m.t0 = run.t; swShow(0, true); $('sw-msg').textContent = 'Running… press again at Y.'; }
      else if (m.on) {
        m.on = false; m.stopped = true; const t = Math.round((run.t - m.t0) * 100) / 100; swShow(t, false);
        const ideal = run.tX != null && run.tY != null ? run.tY - run.tX : null;
        record(run, t, ideal);
      }
    }
    $('btn-sw').addEventListener('click', manualPress);
    document.addEventListener('keydown', e => {
      if (e.code !== 'Space' || ids[current] !== 'practical' || st.mode !== 'manual') return;
      if (e.target.closest && e.target.closest('input, textarea, button')) { if (!e.target.closest('#btn-sw')) return; }
      e.preventDefault(); if (!e.repeat) manualPress();
    });

    /* ---- table ---- */
    const tbody = $('prac-tbody');
    function record(run, t, ideal) {
      if (!(t > 0.02)) { $('sw-msg').textContent = 'That time is too short to use. Try again.'; return; }
      const D = run.xy.D, r = run.r, r2 = +(r * r).toFixed(4), v = +(D / t).toFixed(2);
      const name = run.ball === 'C' ? 'C' : String(run.ball);
      const idx = st.rows.findIndex(x => Math.abs(x.r - r) < 1e-9);
      const row = { name, r, r2, t, v, fresh: true };
      let note = '';
      if (idx >= 0) { st.rows[idx] = row; note = ' (replaced the earlier run for this sphere)'; } else st.rows.push(row);
      st.rows.sort((a, b) => a.r - b.r);
      st.rowsD = D;
      let s = `Recorded t = ${t.toFixed(2)} s, v = D/t = ${v.toFixed(2)} cm/s${note}.`;
      if (ideal != null && Math.abs(t - ideal) > 0.05) s += ` Reaction time changed it by about ${Math.abs(t - ideal).toFixed(2)} s.`;
      $('sw-msg').textContent = s;
      st.pick = []; renderRows(); renderGraph();
    }
    function fmtR(r) { return String(+r.toFixed(4)); }
    function renderRows() {
      tbody.innerHTML = '';
      if (!st.rows.length) { tbody.innerHTML = '<tr class="empty"><td colspan="6">No readings yet.</td></tr>'; return; }
      st.rows.forEach((x, i) => {
        const tr = document.createElement('tr'); if (x.fresh) { tr.className = 'fresh'; x.fresh = false; }
        tr.innerHTML = `<td>${x.name}</td><td>${fmtR(x.r)}</td><td>${x.r2.toFixed(4)}</td><td>${x.t.toFixed(2)}</td><td>${x.v.toFixed(2)}</td><td><button type="button" class="row-x" aria-label="Remove this reading">×</button></td>`;
        tr.querySelector('.row-x').addEventListener('click', () => { st.rows.splice(i, 1); st.pick = []; renderRows(); renderGraph(); });
        tbody.appendChild(tr);
      });
    }
    function clearRows() { st.rows = []; st.rowsD = null; st.pick = []; st.line = null; renderRows(); renderGraph(); }

    /* ---- graph + slope ---- */
    const gsvg = $('prac-graph');
    const slopeModeRG = radioGroup('slope-mode', b => { st.slopeMode = b.dataset.mode; st.pick = []; st.line = null; renderGraph(); });
    function setS(S, text) {
      if (S !== st.S) { const m = $('check-msg'); m.className = 'check-msg'; m.textContent = ''; $('guide').hidden = true; $('btn-guide').textContent = 'Guided calculation'; }
      st.S = S;
      $('slope-out').innerHTML = text;
      const inS = $('in-s');
      if (S != null && (inS.value === '' || st.autoFilledS)) { inS.value = (+S.toFixed(2)).toString(); st.autoFilledS = true; }
      if (S == null && st.autoFilledS) { inS.value = ''; }
    }
    function renderGraph() {
      const G = graphBase(gsvg);
      const pts = st.rows;
      if (st.slopeMode === 'pick') {
        pts.forEach((p, i) => {
          const g = G.pt(G.layers.pts, p.r2, p.v);
          if (st.pick.includes(i)) g.querySelector('circle').setAttribute('fill', '#f6d58d');
          const h = el('circle', { cx: G.X(p.r2), cy: G.Y(p.v), r: 18, fill: 'transparent', class: 'pt-hit', tabindex: 0, role: 'button', 'aria-label': `Point for ball ${p.name}` }, G.layers.top);
          const act = () => { const k = st.pick.indexOf(i); if (k >= 0) st.pick.splice(k, 1); else { if (st.pick.length >= 2) st.pick.shift(); st.pick.push(i); } renderGraph(); };
          h.addEventListener('click', act);
          h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
          txt(G.layers.top, G.X(p.r2) + 12, G.Y(p.v) + 30, p.name, { 'font-size': 24, fill: '#4a4237', 'font-family': 'Caveat, cursive', 'font-weight': 700 });
        });
        if (pts.length < 2) { setS(null, pts.length ? 'Record at least one more sphere.' : 'Plot at least two points, then choose two points on the line.'); return; }
        if (st.pick.length < 2) { setS(null, `Click two points to read the slope${st.pick.length ? ' (one chosen)' : ''}. Points far apart give the best slope.`); return; }
        const [a, b] = st.pick.map(i => pts[i]).sort((p, q) => p.r2 - q.r2);
        if (Math.abs(b.r2 - a.r2) < 1e-6) { setS(null, 'Those two points have the same r². Pick two different spheres.'); return; }
        const S = (b.v - a.v) / (b.r2 - a.r2);
        const c = a.v - S * a.r2;
        G.line(G.layers.line, 0.002, Math.min(0.138, (15.7 - c) / S), S, c);
        slopeTriangle(G, G.layers.tri, [a.r2, a.v], [b.r2, b.v]);
        setS(S, `S = (v₂ − v₁) / (r₂² − r₁²) = (${b.v.toFixed(2)} − ${a.v.toFixed(2)}) / (${b.r2.toFixed(4)} − ${a.r2.toFixed(4)}) = <b>${S.toFixed(2)} cm⁻¹ s⁻¹</b>`);
      } else {
        pts.forEach(p => G.pt(G.layers.pts, p.r2, p.v));
        if (pts.length < 2) { setS(null, 'Plot at least two points first.'); return; }
        if (!st.line) {
          const n = pts.length, mx = pts.reduce((s, p) => s + p.r2, 0) / n, my = pts.reduce((s, p) => s + p.v, 0) / n;
          let sxy = 0, sxx = 0; pts.forEach(p => { sxy += (p.r2 - mx) * (p.v - my); sxx += (p.r2 - mx) ** 2; });
          const S0 = sxx > 0 ? sxy / sxx : 120, c0 = my - S0 * mx;
          const xa = 0.02, xb = 0.12;
          st.line = [[xa, clamp(S0 * xa + c0 + 0.4, 0.5, 15.5)], [xb, clamp(S0 * xb + c0 - 0.4, 0.5, 15.5)]];
        }
        const [A, B] = st.line;
        const S = (B[1] - A[1]) / (B[0] - A[0]), c = A[1] - S * A[0];
        const lo = Math.max(0.002, S > 0 ? (0.25 - c) / S : 0.002), hi = Math.min(0.138, S > 0 ? (15.7 - c) / S : 0.138);
        G.line(G.layers.line, Math.min(lo, A[0]), Math.max(hi, B[0]), S, c);
        slopeTriangle(G, G.layers.tri, A, B);
        st.line.forEach((P, k) => {
          const h = el('circle', { cx: G.X(P[0]), cy: G.Y(P[1]), r: 11, fill: '#2f6f8f', stroke: '#fff', 'stroke-width': 3, class: 'pt-hit', style: 'touch-action:none' }, G.layers.top);
          h.addEventListener('pointerdown', e => {
            e.preventDefault();
            const mv = ev => { const q = svgPoint(gsvg, ev); const [x, y] = G.inv(q.x, q.y); const nx = clamp(x, 0.004, 0.136); if (Math.abs(nx - st.line[1 - k][0]) < 0.01) return; st.line[k] = [nx, clamp(y, 0.25, 15.75)]; scheduleRender(); };
            const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); renderGraph(); };
            window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
          });
        });
        const [P, Q] = st.line[0][0] < st.line[1][0] ? st.line : [st.line[1], st.line[0]];
        const S2 = (Q[1] - P[1]) / (Q[0] - P[0]);
        setS(S2, `Drag the two handles so the line passes as close as possible to all points. S = (${Q[1].toFixed(2)} − ${P[1].toFixed(2)}) / (${Q[0].toFixed(4)} − ${P[0].toFixed(4)}) = <b>${S2.toFixed(2)} cm⁻¹ s⁻¹</b>`);
      }
    }
    let rq = 0; function scheduleRender() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; renderGraph(); }); }
    $('in-s').addEventListener('input', () => { st.autoFilledS = false; });

    /* ---- η check + guided calculation ---- */
    const msg = $('check-msg');
    function say(cls, html) { msg.className = 'check-msg ' + cls; msg.innerHTML = html; }
    const near = (a, b, tol) => Math.abs(a - b) <= Math.abs(b) * tol;
    $('btn-check').addEventListener('click', () => {
      const S = parseNum($('in-s').value), g = parseNum($('in-g').value), eta = parseNum($('in-eta').value);
      if (!(S > 0)) { say('bad', 'Enter the slope S from the graph first.'); return; }
      const ref = st.S != null ? st.S : null;
      if (S < 1 && near(1 / S, ref || LAB.S, 0.05)) { say('nudge', 'This slope looks upside down (Δr²/Δv). v is on the y-axis, so S = Δv / Δr².'); return; }
      if (ref != null && !near(S, ref, 0.03)) { say('nudge', `This S does not match the graph (${ref.toFixed(2)} cm⁻¹ s⁻¹). Use the slope read from the graph.`); return; }
      if (ref == null && !near(S, LAB.S, 0.03)) { say('nudge', 'Plot the readings and read S from the graph, or use the example slope S = 120.0 cm⁻¹ s⁻¹.'); return; }
      const want = etaFrom(S, G_CGS);
      const gNudge = 'Convert g to CGS: g = 9.8 m/s² × 100 cm/m = <b>980 cm/s²</b>. With 9.8 the answer comes out 100 times too small.';
      if (!isNaN(g) && near(g, 9.8, 0.03)) { say('nudge', gNudge); return; }
      if (!(eta > 0)) { say('bad', 'Enter a value of η in poise.'); return; }
      if (near(eta, want / 100, 0.05)) { say('nudge', gNudge); return; }
      if (isNaN(g)) { say('nudge', 'Fill in the value of g used, in cm/s².'); return; }
      if (!near(g, 980, 0.01)) { say('bad', 'g should be 980 cm/s².'); return; }
      if (near(eta, want, 0.03)) { say('ok', `✓ Correct. From this slope η = ${want.toFixed(3)} poise (= ${(want / 10).toFixed(4)} Pa·s). For comparison, the worked example gives 11.98 poise.`); return; }
      if (near(eta, (2 / 9) * (RHO_S - RHO_L) * G_CGS * S, 0.05)) { say('nudge', 'That value is η × S. The formula has 1/S: divide by the slope, not multiply.'); return; }
      if (near(eta, (2 / 9) * RHO_S * G_CGS / S, 0.04)) { say('nudge', 'Use the difference of densities: ρs − ρL = 7.86 − 1.26 = 6.6 g/cm³.'); return; }
      say('bad', 'Not yet. Check each step; the guided calculation shows the working.');
    });
    $('btn-guide').addEventListener('click', () => {
      const g = $('guide');
      const Sin = parseNum($('in-s').value);
      const S = Sin > 0 ? Sin : (st.S != null ? st.S : LAB.S);
      const eta = etaFrom(S, G_CGS);
      g.innerHTML = `
        <li>Slope from the graph: S = <b>${S.toFixed(2)}</b> cm⁻¹ s⁻¹${Sin > 0 || st.S != null ? '' : ' (worked example)'}</li>
        <li>Density difference: ρ<sub>s</sub> − ρ<sub>L</sub> = 7.86 − 1.26 = <b>6.6</b> g/cm³</li>
        <li class="hi">Convert g to CGS: g = 9.8 m/s² × 100 cm/m = <b>980 cm/s²</b></li>
        <li>Substitute: <span class="eq-line">η = <sup>2</sup>⁄<sub>9</sub> × 6.6 × 980 × <sup>1</sup>⁄<sub>${S.toFixed(2)}</sub> = 1437.33 / ${S.toFixed(2)}</span></li>
        <li>Result: <b>η = ${eta.toFixed(3)} poise</b> (= ${(eta / 10).toFixed(4)} Pa·s)</li>`;
      g.hidden = !g.hidden;
      $('btn-guide').textContent = g.hidden ? 'Guided calculation' : 'Hide guided calculation';
    });

    /* ---- start over ---- */
    $('btn-reset').addEventListener('click', () => {
      resetSpheres(); st.marks = []; renderMarks(); clearRows();
      swShow(0, false); $('sw-msg').textContent = '';
      ['in-s', 'in-g', 'in-eta'].forEach(i => { $(i).value = ''; }); st.autoFilledS = false;
      msg.className = 'check-msg'; msg.textContent = '';
      $('guide').hidden = true; $('btn-guide').textContent = 'Guided calculation';
      st.line = null; st.pick = [];
    });

    drawMicro(4); $('micro-d-o').textContent = '4.00 mm'; resetSpheres();
    renderMarks(); renderGraph();
    window.__prac = { st, getXY, vModel, renderMarks, PX, yOf, TX0, TX1, SURFACE, YB, spheres, mag, DISH, MX, PARK };
  })();

  /* =====================================================================
     14. OPTIONAL EXTRAS — opens upward, closes ~500 ms after the pointer leaves
     ===================================================================== */
  (function extras() {
    const box = $('extras'), btn = $('extras-toggle');
    let t = null, openedAt = 0;
    const open = () => { clearTimeout(t); if (!box.classList.contains('open')) openedAt = Date.now(); box.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); };
    const close = () => { clearTimeout(t); box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
    const later = () => { clearTimeout(t); t = setTimeout(close, 500); };
    box.addEventListener('mouseenter', open);
    box.addEventListener('mouseleave', later);
    btn.addEventListener('click', () => {
      if (!box.classList.contains('open')) open();
      else if (Date.now() - openedAt > 350) close();
    });
    box.addEventListener('focusin', open);
    box.addEventListener('focusout', e => { if (!box.contains(e.relatedTarget)) later(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  })();

  goTo(fromHash(), false);
})();
