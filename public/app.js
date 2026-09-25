(() => {
'use strict';

const AREAS = {
  o1: { name: 'Propisi o sigurnosti saobraćaja', short: 'Propisi', desc: 'Zakon, pravila saobraćaja, vozila i vozači',
        ico: '<svg viewBox="0 0 32 32"><rect x="6" y="4" width="20" height="24" rx="3" fill="#fff" stroke="#0b3d91" stroke-width="2.2"/><path d="M11 11h10M11 16h10M11 21h6" stroke="#0b3d91" stroke-width="2.2" stroke-linecap="round"/></svg>' },
  o2: { name: 'Saobraćajni znakovi', short: 'Znakovi', desc: 'Znakovi opasnosti, izričitih naredbi i obavještenja',
        ico: '<svg viewBox="0 0 32 32"><path d="M16 3 30 28H2z" fill="#fff" stroke="#d7261e" stroke-width="3" stroke-linejoin="round"/><path d="M16 11v8" stroke="#111" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="23" r="1.6" fill="#111"/></svg>' },
  o3: { name: 'Saobraćajne situacije', short: 'Raskrsnice', desc: 'Prvenstvo prolaza i redoslijed na raskrsnicama',
        ico: '<svg viewBox="0 0 32 32"><rect x="12" y="2" width="8" height="28" fill="#5d6777"/><rect x="2" y="12" width="28" height="8" fill="#5d6777"/><path d="M16 4v6M16 22v6M4 16h6M22 16h6" stroke="#fff" stroke-width="1.6" stroke-dasharray="2 2"/><circle cx="16" cy="16" r="3" fill="#e8a200"/></svg>' },
  o4: { name: 'Prva pomoć', short: 'Prva pomoć', desc: 'Pružanje prve pomoći povrijeđenima',
        ico: '<svg viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="6" fill="#fff" stroke="#d7261e" stroke-width="2.2"/><path d="M16 9v14M9 16h14" stroke="#d7261e" stroke-width="4.5" stroke-linecap="round"/></svg>' },
};
const CATS = [
  { k: 'sve', label: 'Sve kategorije' },
  { k: 'A', label: 'A', sub: 'motocikl' },
  { k: 'B', label: 'B', sub: 'automobil' },
  { k: 'C', label: 'C', sub: 'teretno' },
  { k: 'D', label: 'D', sub: 'autobus' },
  { k: 'T', label: 'T', sub: 'traktor' },
];

const $app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

const store = {
  get(k, d) { try { const v = localStorage.getItem('vi:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('vi:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

let Q = [], byId = {};
let cat = store.get('cat', 'sve');
let progress = store.get('prog', {}); // id -> 1 correct / 0 wrong (last attempt)
let session = null;

// ---------- theme ----------
const themeBtn = document.getElementById('themeBtn');
const applyTheme = t => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
applyTheme(store.get('theme', null));
themeBtn.onclick = () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const t = dark ? 'light' : 'dark'; applyTheme(t); store.set('theme', t);
};

// ---------- lightbox ----------
const lb = document.getElementById('lightbox');
const openImg = src => { lb.querySelector('img').src = src; lb.hidden = false; };
lb.onclick = () => { lb.hidden = true; };

// ---------- data helpers ----------
const inCat = q => cat === 'sve' || !q.cat || q.cat.includes(cat);
const pool = area => Q.filter(q => (!area || q.area === area) && inCat(q));
const correctSet = q => q.a.map((a, i) => a.ok ? i : -1).filter(i => i >= 0);
const isMulti = q => correctSet(q).length > 1;
const stat = list => {
  let g = 0, r = 0;
  for (const q of list) { const p = progress[q.id]; if (p === 1) g++; else if (p === 0) r++; }
  return { g, r, total: list.length };
};
const record = (q, ok) => { progress[q.id] = ok ? 1 : 0; store.set('prog', progress); };

// ---------- routing ----------
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
window.addEventListener('hashchange', route);
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go]');
  if (t) { e.preventDefault(); go(t.dataset.go === 'home' ? '#/' : t.dataset.go); }
});

function route() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean);
  window.scrollTo(0, 0);
  if (parts[0] === 'vjezba') return startPractice(parts[1], params.get('red') === 'nasumicno');
  if (parts[0] === 'pogresni') return startWrong();
  if (parts[0] === 'test') return startTest(+params.get('n') || 30);
  if (parts[0] === 'pregled') return renderBrowse(params);
  if (parts[0] === 'rezultat' && session && session.back) session = session.back;
  if (parts[0] === 'rezultat' && session && session.mode === 'test' && session.done) return renderResult();
  renderHome();
}

// ---------- home ----------
function renderHome() {
  session = null;
  const all = pool();
  const s = stat(all);
  const wrong = all.filter(q => progress[q.id] === 0).length;
  const testN = store.get('testN', 30);
  $app.innerHTML = `
    <h1>Pripremi se za vozački ispit</h1>
    <p class="lead">Svih ${Q.length} pitanja iz zvaničnog kataloga Ministarstva za odgoj i obrazovanje KS — sa slikama iz dokumenta. Klikni odgovor i odmah vidiš da li je tačan.</p>

    <div class="stats">
      <div class="stat"><b>${all.length}</b><span>pitanja za tvoj izbor</span></div>
      <div class="stat"><b style="color:var(--ok)">${s.g}</b><span>tačno odgovoreno</span></div>
      <div class="stat"><b style="color:var(--bad)">${s.r}</b><span>za ponoviti</span></div>
    </div>

    <h2>Za koju kategoriju polažeš?</h2>
    <div class="chips" role="group" aria-label="Kategorija">
      ${CATS.map(c => `<button class="chip" data-cat="${c.k}" aria-pressed="${cat === c.k}">${c.label}${c.sub ? ` <small>${c.sub}</small>` : ''}</button>`).join('')}
    </div>
    <p class="note">Kategorija filtrira pitanja iz propisa (katalog označava za koje kategorije važe). Znakovi, raskrsnice i prva pomoć važe za sve.</p>

    <div class="panel test-cta" style="margin-top:22px">
      <div><h3>Probni test</h3><p>Nasumična pitanja iz svih oblasti, rezultat na kraju.</p></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div class="seg" role="group" aria-label="Broj pitanja">
          ${[20, 30, 50].map(n => `<button data-n="${n}" aria-pressed="${n === testN}">${n}</button>`).join('')}
        </div>
        <button class="btn big" id="startTest">Započni test →</button>
      </div>
    </div>

    <h2>Vježbaj po oblastima</h2>
    <div class="areas">
      ${Object.entries(AREAS).map(([k, a]) => {
        const p = pool(k), st = stat(p);
        const gw = p.length ? st.g / p.length * 100 : 0, rw = p.length ? st.r / p.length * 100 : 0;
        return `<article class="area">
          <div class="area-h"><div class="area-ico">${a.ico}</div><div><h3>${a.name}</h3><p>${p.length} pitanja · ${a.desc}</p></div></div>
          <div class="bar" aria-hidden="true"><i class="g" style="width:${gw}%"></i><i class="r" style="width:${rw}%"></i></div>
          <div class="bar-l"><span>${st.g + st.r} / ${p.length} urađeno</span><span>${st.g ? Math.round(st.g / (st.g + st.r) * 100) + '% tačno' : ''}</span></div>
          <div class="area-a">
            <button class="btn primary" data-go="#/vjezba/${k}">${st.g + st.r ? 'Nastavi' : 'Vježbaj'}</button>
            <button class="btn" data-go="#/vjezba/${k}?red=nasumicno">Nasumično</button>
            <button class="btn ghost" data-go="#/pregled?o=${k}">Pregled</button>
          </div>
        </article>`;
      }).join('')}
    </div>

    <div class="toolbar">
      <button class="btn" data-go="#/pogresni" ${wrong ? '' : 'disabled'}>↻ Ponovi pogrešne (${wrong})</button>
      <button class="btn" data-go="#/pregled">🔎 Pretraži sva pitanja</button>
      <button class="btn ghost" id="reset" ${s.g + s.r ? '' : 'disabled'}>Obriši napredak</button>
    </div>`;

  $app.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat; store.set('cat', cat); renderHome(); });
  $app.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { store.set('testN', +b.dataset.n); renderHome(); });
  $app.querySelector('#startTest').onclick = () => go('#/test?n=' + store.get('testN', 30));
  const r = $app.querySelector('#reset');
  r.onclick = () => { if (confirm('Obrisati sav napredak na ovom uređaju?')) { progress = {}; store.set('prog', progress); renderHome(); } };
}

// ---------- practice / test sessions ----------
function startPractice(area, random) {
  if (!AREAS[area]) return go('#/');
  let list = pool(area);
  let idx = 0;
  if (random) list = shuffle(list);
  else { const f = list.findIndex(q => progress[q.id] !== 1); idx = f < 0 ? 0 : f; }
  session = { mode: 'practice', title: AREAS[area].name + (random ? ' · nasumično' : ''), list, idx, answers: {}, g: 0, r: 0 };
  renderQuestion();
}
function startWrong() {
  const list = shuffle(pool().filter(q => progress[q.id] === 0));
  if (!list.length) return go('#/');
  session = { mode: 'practice', title: 'Ponavljanje pogrešnih', list, idx: 0, answers: {}, g: 0, r: 0 };
  renderQuestion();
}
function startTest(n) {
  // proportional mix across areas
  const areas = Object.keys(AREAS), all = pool();
  let picked = [];
  for (const a of areas) {
    const p = pool(a); const k = Math.max(1, Math.round(n * p.length / all.length));
    picked.push(...shuffle(p).slice(0, k));
  }
  picked = shuffle(picked).slice(0, n);
  session = { mode: 'test', title: `Probni test · ${picked.length} pitanja`, list: picked, idx: 0, answers: {}, done: false };
  renderQuestion();
}

function renderQuestion() {
  const s = session, q = s.list[s.idx];
  const multi = isMulti(q);
  const ans = s.answers[q.id]; // {sel:[...], checked:bool}
  const checked = ans && ans.checked;
  const reveal = checked && s.mode === 'practice';
  const sel = ans ? ans.sel : [];
  const cs = correctSet(q);
  const pct = ((s.idx + (checked ? 1 : 0)) / s.list.length) * 100;
  const area = AREAS[q.area];

  const optHtml = q.a.map((a, i) => {
    let cls = 'opt' + (multi ? ' multi' : ''), mark = '';
    const picked = sel.includes(i);
    if (reveal) {
      if (a.ok && picked) { cls += ' ok'; mark = '✓ tačno'; }
      else if (a.ok) { cls += ' ok missed'; mark = '✓ tačan odgovor'; }
      else if (picked) { cls += ' bad'; mark = '✕'; }
    }
    return `<button class="${cls}" data-i="${i}" aria-pressed="${!reveal && picked}" ${reveal ? 'disabled' : ''}>
      <span class="k">${reveal && a.ok ? '✓' : reveal && picked ? '✕' : i + 1}</span><span class="t">${esc(a.t)}</span>${mark ? `<span class="mark">${mark}</span>` : ''}</button>`;
  }).join('');

  let fb = '';
  if (reveal) {
    const ok = sameSet(sel, cs);
    fb = `<div class="feedback ${ok ? 'ok' : 'bad'}" role="status">${ok ? '✓ Tačno!' : '✕ Netačno — tačan odgovor je označen zelenim.'}</div>`;
  }

  const isLast = s.idx === s.list.length - 1;
  let primary;
  if (s.mode === 'practice') {
    primary = reveal
      ? `<button class="btn primary big" id="next">${isLast ? 'Završi' : 'Sljedeće →'}</button>`
      : multi ? `<button class="btn primary big" id="check" ${sel.length ? '' : 'disabled'}>Provjeri</button>` : '';
  } else {
    primary = `<button class="btn primary big" id="next" ${sel.length ? '' : 'disabled'}>${isLast ? 'Predaj test' : 'Dalje →'}</button>`;
  }

  const score = s.mode === 'practice'
    ? `<div class="score"><span class="g">✓ ${s.g}</span><span class="r">✕ ${s.r}</span></div>`
    : `<div class="score">${Object.values(s.answers).filter(a => a.sel.length).length}/${s.list.length}</div>`;

  $app.innerHTML = `
    <div class="qbar">
      <button class="back" data-go="${s.back ? '#/rezultat' : 'home'}" aria-label="Nazad">←</button>
      <div class="qbar-mid">
        <div class="qbar-t"><b>${esc(s.title)}</b><span>${s.idx + 1} / ${s.list.length}</span></div>
        <div class="prog"><i style="width:${pct}%"></i></div>
      </div>
      ${score}
    </div>
    <article class="qcard">
      ${q.img ? `<div class="qimg" data-img="${q.img[0].src}"><img src="${q.img[0].src}" alt="Ilustracija iz kataloga uz pitanje ${q.n}"><span class="zoom">🔍 uvećaj</span></div>` : ''}
      <div class="qbody">
        <div class="qmeta">
          <span class="tag">${area.short} · pitanje ${q.n}</span>
          ${q.cat ? `<span class="tag">Kat. ${q.cat.join(', ')}</span>` : ''}
          ${multi ? '<span class="tag multi">Više tačnih odgovora</span>' : ''}
        </div>
        <h2 class="qtext">${esc(q.q)}</h2>
        <div class="opts">${optHtml}</div>
        ${fb}
        <div class="qfoot">
          <span class="src">Katalog, oblast ${q.area.slice(1)} · str. ${q.page}</span>
          <div class="qnav">
            <button class="btn" id="prev" ${s.idx === 0 ? 'disabled' : ''} aria-label="Prethodno">←</button>
            ${s.mode === 'practice' && !reveal && !multi ? `<button class="btn" id="skip">Preskoči</button>` : ''}
            ${primary}
          </div>
        </div>
      </div>
    </article>
    <p class="kbd-hint">Tastatura: <kbd>1</kbd>–<kbd>${q.a.length}</kbd> odgovor · <kbd>Enter</kbd> dalje · <kbd>←</kbd> <kbd>→</kbd> navigacija</p>`;

  $app.querySelectorAll('.opt').forEach(b => b.onclick = () => choose(+b.dataset.i));
  const img = $app.querySelector('.qimg'); if (img) img.onclick = () => openImg(img.dataset.img);
  bind('#prev', () => move(-1));
  bind('#skip', () => move(1));
  bind('#check', check);
  bind('#next', next);
}
const bind = (sel, fn) => { const el = $app.querySelector(sel); if (el) el.onclick = fn; };
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

function choose(i) {
  const s = session, q = s.list[s.idx];
  const a = s.answers[q.id] || (s.answers[q.id] = { sel: [], checked: false });
  if (a.checked && s.mode === 'practice') return;
  if (isMulti(q)) a.sel = a.sel.includes(i) ? a.sel.filter(x => x !== i) : [...a.sel, i];
  else a.sel = [i];
  if (s.mode === 'practice' && !isMulti(q)) return check();
  renderQuestion();
}
function check() {
  const s = session, q = s.list[s.idx], a = s.answers[q.id];
  if (!a || !a.sel.length || a.checked) return;
  a.checked = true;
  const ok = sameSet(a.sel, correctSet(q));
  if (ok) s.g++; else s.r++;
  record(q, ok);
  renderQuestion();
  const fb = $app.querySelector('.feedback'); if (fb) fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function next() {
  const s = session;
  if (s.mode === 'test') {
    const q = s.list[s.idx]; const a = s.answers[q.id];
    if (!a || !a.sel.length) return;
    a.checked = true;
    if (s.idx === s.list.length - 1) return finishTest();
  } else if (s.idx === s.list.length - 1) return renderPracticeDone();
  move(1);
}
function move(d) {
  const s = session; const n = s.idx + d;
  if (n < 0 || n >= s.list.length) return;
  s.idx = n; renderQuestion(); window.scrollTo({ top: 0 });
}

function renderPracticeDone() {
  const s = session, t = s.g + s.r;
  $app.innerHTML = `<div class="panel result">
    ${ring(t ? s.g / t : 0)}
    <div class="verdict ${s.r ? '' : 'ok'}">Oblast završena!</div>
    <p class="lead">${s.g} tačnih i ${s.r} netačnih odgovora u ovoj sesiji.</p>
    <div class="toolbar" style="justify-content:center">
      ${s.r ? '<button class="btn primary" data-go="#/pogresni">Ponovi pogrešne</button>' : ''}
      <button class="btn" data-go="home">Početna</button>
    </div></div>`;
}

function finishTest() {
  const s = session; s.done = true;
  s.results = s.list.map(q => {
    const ok = sameSet((s.answers[q.id] || { sel: [] }).sel, correctSet(q));
    record(q, ok); return ok;
  });
  go('#/rezultat');
}
function ring(f) {
  const r = 64, c = 2 * Math.PI * r;
  const col = f >= .9 ? 'var(--ok)' : f >= .7 ? 'var(--warn)' : 'var(--bad)';
  return `<div class="ring"><svg viewBox="0 0 150 150" width="150" height="150"><circle cx="75" cy="75" r="${r}" fill="none" stroke="var(--line)" stroke-width="12"/><circle cx="75" cy="75" r="${r}" fill="none" stroke="${col}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c * f} ${c}"/></svg><b>${Math.round(f * 100)}%</b></div>`;
}
function renderResult() {
  const s = session, g = s.results.filter(Boolean).length, n = s.list.length, f = g / n;
  $app.innerHTML = `<div class="panel result">
    ${ring(f)}
    <div class="verdict ${f >= .9 ? 'ok' : 'bad'}">${f >= .9 ? 'Odlično, spreman si!' : f >= .7 ? 'Blizu si — još malo vježbe' : 'Treba još vježbe'}</div>
    <p class="lead">${g} od ${n} tačno. Klikni pitanje da vidiš tačan odgovor.</p>
    <div class="toolbar" style="justify-content:center">
      <button class="btn primary" data-go="#/test?n=${n}&r=${Date.now()}">Novi test</button>
      ${g < n ? '<button class="btn" data-go="#/pogresni">Vježbaj pogrešne</button>' : ''}
      <button class="btn" data-go="home">Početna</button>
    </div>
    <div class="rlist">
      ${s.list.map((q, i) => `<button class="ritem" data-ri="${i}">
        <span class="dot ${s.results[i] ? 'g' : 'r'}">${s.results[i] ? '✓' : '✕'}</span>
        ${q.img ? `<img src="${q.img[0].src}" alt="">` : ''}
        <span>${esc(q.q)}</span></button>`).join('')}
    </div></div>`;
  $app.querySelectorAll('[data-ri]').forEach(b => b.onclick = () => {
    // review mode: reuse practice renderer with revealed answers
    const i = +b.dataset.ri;
    session = { mode: 'practice', title: 'Pregled testa', list: s.list, idx: i, g, r: n - g, back: s,
      answers: Object.fromEntries(s.list.map(q => [q.id, { sel: (s.answers[q.id] || { sel: [] }).sel, checked: true }])) };
    renderQuestion();
  });
}

// ---------- browse ----------
function renderBrowse(params) {
  session = null;
  const area = params.get('o') || '';
  let limit = 40;
  const state = { q: '', area, show: true, onlyImg: false };
  $app.innerHTML = `
    <div class="qbar"><button class="back" data-go="home" aria-label="Nazad">←</button><div class="qbar-mid"><b>Pregled pitanja</b></div></div>
    <div class="search">
      <input type="search" id="s" placeholder="Pretraži pitanja i odgovore…" autocomplete="off">
      <select id="o"><option value="">Sve oblasti</option>${Object.entries(AREAS).map(([k, a]) => `<option value="${k}" ${k === area ? 'selected' : ''}>${a.name}</option>`).join('')}</select>
    </div>
    <div class="chips" style="margin-bottom:12px">
      <button class="chip" id="toggleAns" aria-pressed="true">Prikaži tačne odgovore</button>
      <button class="chip" id="toggleImg" aria-pressed="false">Samo sa slikom</button>
    </div>
    <div class="blist" id="bl"></div>
    <div class="more"><button class="btn" id="more">Prikaži još</button></div>`;
  const $s = $app.querySelector('#s'), $o = $app.querySelector('#o'), $bl = $app.querySelector('#bl'), $more = $app.querySelector('#more');
  const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj');
  const draw = () => {
    const needle = norm(state.q.trim());
    const res = pool(state.area).filter(q => (!state.onlyImg || q.img) && (!needle || norm(q.q + ' ' + q.a.map(a => a.t).join(' ')).includes(needle)));
    const show = res.slice(0, limit);
    $bl.innerHTML = show.length ? show.map(q => `
      <div class="bitem ${q.img ? 'hasimg' : ''}">
        <div>
          <h4><small>${AREAS[q.area].short} ${q.n}</small>${esc(q.q)}</h4>
          <ul class="${state.show ? '' : 'hidden-ans'}">${q.a.map(a => `<li class="${a.ok ? 'ok' : ''}">${a.ok && state.show ? '✓ ' : ''}${esc(a.t)}</li>`).join('')}</ul>
        </div>
        ${q.img ? `<div class="thumb" data-img="${q.img[0].src}"><img loading="lazy" src="${q.img[0].src}" alt="Ilustracija uz pitanje ${q.n}"></div>` : ''}
      </div>`).join('') : '<div class="empty">Nema rezultata.</div>';
    $more.hidden = res.length <= limit;
    $more.textContent = `Prikaži još (${res.length - limit})`;
    $bl.querySelectorAll('[data-img]').forEach(t => t.onclick = () => openImg(t.dataset.img));
  };
  let tmr;
  $s.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => { state.q = $s.value; limit = 40; draw(); }, 120); };
  $o.onchange = () => { state.area = $o.value; limit = 40; draw(); };
  $more.onclick = () => { limit += 60; draw(); };
  const ta = $app.querySelector('#toggleAns'), ti = $app.querySelector('#toggleImg');
  ta.onclick = () => { state.show = !state.show; ta.setAttribute('aria-pressed', state.show); draw(); };
  ti.onclick = () => { state.onlyImg = !state.onlyImg; ti.setAttribute('aria-pressed', state.onlyImg); draw(); };
  draw();
}

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  if (!lb.hidden && e.key === 'Escape') { lb.hidden = true; return; }
  if (!session || session.done && session.mode === 'test' || (e.target.matches && e.target.matches('input,select,textarea')) || e.metaKey || e.ctrlKey) return;
  if (!$app.querySelector('.qcard')) return;
  const q = session.list[session.idx];
  if (/^[1-9]$/.test(e.key) && +e.key <= q.a.length) { e.preventDefault(); choose(+e.key - 1); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    const nb = $app.querySelector('#next:not(:disabled)'), cb = $app.querySelector('#check:not(:disabled)');
    (nb || cb) && (nb || cb).click();
  }
  else if (e.key === 'ArrowRight') move(1);
  else if (e.key === 'ArrowLeft') move(-1);
});

// ---------- boot ----------
$app.innerHTML = '<p class="empty">Učitavam pitanja…</p>';
fetch('data/questions.json').then(r => r.json()).then(d => {
  Q = d; byId = Object.fromEntries(Q.map(q => [q.id, q]));
  route();
}).catch(() => { $app.innerHTML = '<p class="empty">Greška pri učitavanju pitanja. Osvježi stranicu.</p>'; });
})();
