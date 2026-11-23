// Algebra Climb: app logic (state, sync, screens).
(function () {
  'use strict';
  const { LEVELS, generate, gcd, fr } = window.ALG;
  const CFG = window.CLIMB_CONFIG || {};
  const CLOUD = !!(CFG.supabaseUrl && CFG.supabaseKey);
  const LKEY = 'algebra-climb-state-v1';
  const CKEY = 'algebra-climb-code';
  const $ = (s, el = document) => el.querySelector(s);
  const app = $('#app');

  // ---------- icons ----------
  const I = {
    star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3.5 5 5.6 5 10.5A5 5 0 0 1 7 12.5c0-2 1-3.3 2-4.3.2 1.8 1 2.8 2 3.3C11 8.6 10.6 5.4 12 2z"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    test: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4V14H4zM10 20h4V9h-4zM16 20h4V4h-4z"/></svg>',
    scores: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12H9M13 6l-6 6 6 6"/><path d="M3 5v14"/></svg>'
  };

  // ---------- state ----------
  const blank = () => ({
    v: 1, name: '', points: 0, level: 1, placed: false, strong: 0,
    tests: [], lessons: [], streak: { count: 0, last: '' }, stats: {}, updated: 0
  });
  let S = blank();
  let storageOK = true;

  function readLocal() {
    try { const raw = localStorage.getItem(LKEY); return raw ? Object.assign(blank(), JSON.parse(raw)) : null; }
    catch (e) { storageOK = false; return null; }
  }
  function writeLocal() {
    try { localStorage.setItem(LKEY, JSON.stringify(S)); } catch (e) { storageOK = false; }
  }
  function getCode() {
    let c = null;
    try {
      const u = new URL(location.href);
      c = u.searchParams.get('code');
      if (c) {
        localStorage.setItem(CKEY, c);
        u.searchParams.delete('code');
        history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
      } else c = localStorage.getItem(CKEY);
    } catch (e) { /* ignore */ }
    return c;
  }
  function setCode(c) { try { localStorage.setItem(CKEY, c); } catch (e) { /* ignore */ } code = c; }
  function newCode() {
    const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
    const r = new Uint32Array(20); crypto.getRandomValues(r);
    let s = ''; for (let i = 0; i < 20; i++) { s += abc[r[i] % abc.length]; if (i % 5 === 4 && i < 19) s += '-'; }
    return s;
  }
  let code = getCode();

  // ---------- cloud sync ----------
  let syncState = CLOUD ? 'pending' : 'local';
  let pushTimer = null, dirty = false;
  async function rpc(fn, body) {
    const headers = { 'apikey': CFG.supabaseKey, 'Content-Type': 'application/json' };
    if (/^eyJ/.test(CFG.supabaseKey)) headers.Authorization = 'Bearer ' + CFG.supabaseKey;
    const r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('sync ' + r.status);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  async function pull() {
    if (!CLOUD || !code) return;
    try {
      const remote = await rpc('get_progress', { p_code: code });
      if (remote && (remote.updated || 0) > (S.updated || 0)) {
        S = Object.assign(blank(), remote); writeLocal();
        if (!session) render();
      } else if (!remote || (S.updated || 0) > (remote.updated || 0)) {
        if (S.updated) { dirty = true; await push(); }
      }
      if (!dirty) setSync('ok');
    } catch (e) { setSync('off'); }
  }
  async function push() {
    if (!CLOUD || !code) return;
    try { setSync('pending'); await rpc('save_progress', { p_code: code, p_data: S }); dirty = false; setSync('ok'); }
    catch (e) { setSync('off'); }
  }
  function save() {
    S.updated = Date.now();
    writeLocal();
    if (CLOUD && code) { dirty = true; setSync('pending'); clearTimeout(pushTimer); pushTimer = setTimeout(push, 700); }
  }
  function setSync(s) { syncState = s; const el = $('#sync'); if (el) el.outerHTML = syncHTML(); }
  function syncHTML() {
    if (!CLOUD) return `<span id="sync" class="sync pending" title="Progress is saved on this device only"><i class="dot"></i><span>This device</span></span>`;
    const t = { ok: 'Saved', pending: 'Saving…', off: 'Offline' }[syncState] || 'Saved';
    const cls = { ok: '', pending: 'pending', off: 'off' }[syncState] || '';
    return `<span id="sync" class="sync ${cls}" title="${syncState === 'off' ? 'Will save when back online' : 'Progress is saved online'}"><i class="dot"></i><span>${t}</span></span>`;
  }
  window.addEventListener('online', () => { if (dirty) push(); else pull(); });
  setInterval(() => { if (dirty) push(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !session) pull(); });

  // ---------- utils ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtMins = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? '<1 min' : m + ' min'; };
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const lvlName = (n) => (LEVELS[n - 1] ? LEVELS[n - 1].name : '');
  const basePts = (lvl) => lvl * 10;
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
  function stat(lvl, ok) {
    const s = S.stats[lvl] || (S.stats[lvl] = { c: 0, w: 0 });
    ok ? s.c++ : s.w++;
  }

  // ---------- confetti ----------
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas'); c.id = 'confetti'; document.body.appendChild(c);
    const ctx = c.getContext('2d'); const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const cols = ['--accent', '--gold', '--good', '--bad'].map((v) => css.getPropertyValue(v).trim());
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 4, a: Math.random() * 6, col: cols[Math.floor(Math.random() * cols.length)] }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach((p) => { p.vy += 0.42; p.x += p.vx; p.y += p.vy; p.a += 0.2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.col; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
      if (t - t0 < 2200) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  // ---------- shell ----------
  let tab = 'home';
  let session = null; // active test/lesson
  const brand = `<div class="brand"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)"/><path d="M6 24l6-7 4 4 9-11" fill="none" stroke="var(--on-accent)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25" cy="10" r="2.6" fill="var(--gold)"/></svg><span>Algebra Climb</span></div>`;

  function shell(inner) {
    document.body.classList.toggle('in-session', !!session);
    app.innerHTML = `
      <header class="top"><div class="wrap">${brand}
        <div class="stats">${syncHTML()}
          <span class="pill lvl" title="Lesson level">Level ${S.level}</span>
          <span class="pill gold" title="Points">${I.star}<span id="ptsNum">${S.points.toLocaleString()}</span></span>
          <span class="pill" title="Day streak" style="color:var(--bad)">${I.flame}${S.streak.count}</span>
        </div></div></header>
      ${storageOK ? '' : '<div class="wrap" style="padding-top:12px"><div class="card small" style="background:var(--warn-soft)">This browser is blocking storage (private browsing?), so progress may not be saved on this device.</div></div>'}
      <main><div class="wrap">${inner}</div></main>
      <nav class="tabs" aria-label="Sections"><div class="wrap">
        ${[['home', 'Today', I.home], ['test', 'Test', I.test], ['scores', 'Scores', I.scores], ['settings', 'Settings', I.gear]]
          .map(([id, label, ic]) => `<button class="tab" data-tab="${id}" ${tab === id ? 'aria-current="page"' : ''}>${ic}${label}</button>`).join('')}
      </div></nav>`;
    app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
  }
  function bumpPoints() { const el = $('#ptsNum'); if (el) el.textContent = S.points.toLocaleString(); }

  function render() {
    if (session) return renderSession();
    if (CLOUD && !code) return renderJoin();
    if (!S.name) return renderWelcome();
    ({ home: renderHome, test: renderTestTab, scores: renderScores, settings: renderSettings }[tab] || renderHome)();
  }

  // ---------- join / welcome ----------
  function renderJoin() {
    document.body.classList.remove('in-session');
    app.innerHTML = `<main><div class="wrap" style="max-width:560px;margin-inline:auto;width:100%"><div class="stack" style="padding-top:8vh">
      ${brand}
      <div class="card stack">
        <h1 style="font-size:1.8rem">Open your progress</h1>
        <p class="muted">Use the personal link you were sent, or type the family code from it.</p>
        <label class="small" for="joinCode">Family code</label>
        <input type="text" id="joinCode" placeholder="abcde-fghij-kmnpq-rstuv" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="btn big block" id="joinGo">Open</button>
        <p class="small muted" id="joinMsg"></p>
      </div>
      <div class="card stack">
        <h3>Setting this up for the first time?</h3>
        <p class="muted small">Make a new family code. You'll get a personal link to send to each device.</p>
        <button class="btn ghost" id="joinNew">Start fresh</button>
      </div></div></div></main>`;
    $('#joinGo').onclick = async () => {
      const c = $('#joinCode').value.trim().toLowerCase();
      if (c.length < 16) { $('#joinMsg').textContent = 'That code looks too short. It should look like abcde-fghij-kmnpq-rstuv.'; return; }
      setCode(c); $('#joinMsg').textContent = 'Opening…';
      await pull();
      if (!S.updated) { $('#joinMsg').textContent = 'No progress found for that code yet. You can start fresh with it.'; }
      render();
    };
    $('#joinNew').onclick = () => { setCode(newCode()); render(); };
  }

  function renderWelcome() {
    document.body.classList.remove('in-session');
    app.innerHTML = `<main><div class="wrap" style="max-width:560px;margin-inline:auto;width:100%"><div class="stack" style="padding-top:8vh">
      ${brand}
      <div class="card stack">
        <h1 style="font-size:2rem">Hi! Let's climb some algebra.</h1>
        <p class="muted">First a quick placement test finds your level. Then each day you get a 20 to 30 minute lesson that levels up as you do. Every right answer earns points, and harder levels earn more.</p>
        <label for="nameIn" class="small">What should we call you?</label>
        <input type="text" id="nameIn" maxlength="24" autocomplete="off" placeholder="Your first name">
        <button class="btn big block" id="nameGo">Let's go</button>
      </div></div></div></main>`;
    const go = () => { const n = $('#nameIn').value.trim(); if (!n) { $('#nameIn').focus(); return; } S.name = n; save(); render(); };
    $('#nameGo').onclick = go;
    $('#nameIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  }

  // ---------- home ----------
  function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
  function ladderHTML(clickable) {
    return `<div class="ladder">${LEVELS.slice().reverse().map((L) => {
      const st = L.n < S.level ? 'done' : L.n === S.level ? 'now' : 'locked';
      const tag = st === 'done' ? 'Done' : st === 'now' ? 'You are here' : '';
      const btn = clickable && L.n <= S.level ? `<button data-practice="${L.n}">Practice</button>` : `<span class="tag">${tag}</span>`;
      return `<div class="rung ${st}"><b>${L.n}</b><span>${L.name}</span>${clickable && st !== 'locked' ? btn : `<span class="tag">${tag}</span>`}</div>`;
    }).join('')}</div>`;
  }
  function renderHome() {
    const doneToday = S.lessons.some((l) => l.day === dayKey() && l.mode === 'lesson');
    const lastTest = S.tests[S.tests.length - 1];
    const L = LEVELS[S.level - 1];
    const todayCard = !S.placed
      ? `<section class="card today"><span class="eyebrow">Step 1</span><h2>Take the placement test</h2>
          <p>It starts easy and gets harder until it finds your level. It takes about 15 to 25 minutes. No hints, just do your best.</p>
          <button class="btn big" id="goTest">Start the test</button></section>`
      : `<section class="card today"><span class="eyebrow">${doneToday ? 'Done for today. Want more?' : "Today's lesson"}</span>
          <h2>Level ${L.n}: ${L.name}</h2>
          <p>About 20 to 30 minutes, 15 problems. Mistakes are fine. You'll get hints and a second try.</p>
          <div class="stack" style="gap:6px"><div class="small">${S.level < 10 ? `Level-up progress: ${S.strong} of 2 strong lessons` : 'Top level! Keep your skills sharp.'}</div>
          <div class="meter"><span style="width:${S.level < 10 ? S.strong * 50 : 100}%"></span></div></div>
          <button class="btn big" id="goLesson">${doneToday ? 'Do another lesson' : 'Start lesson'}</button></section>`;
    shell(`<div class="stack">
      <div class="hello"><h1>${greeting()}, ${esc(S.name)}.</h1>
        <p class="muted">${S.streak.count > 1 ? `You're on a ${S.streak.count}-day streak. Keep it going!` : 'A little practice every day adds up fast.'}</p></div>
      ${todayCard}
      <div class="grid2">
        <section class="card stack"><div><span class="eyebrow">Your climb</span><h3 style="margin-top:4px">10 levels of Algebra 1</h3></div>
          ${ladderHTML(S.placed)}
          ${S.placed ? '<p class="small muted">Tap Practice on any level you have reached for extra problems.</p>' : ''}</section>
        <section class="card stack"><span class="eyebrow">How points work</span>
          <p>Each right answer earns <b>10 points × the level</b>. A Level 7 problem is worth 70.</p>
          <ul class="steps" style="list-style:disc">
            <li>Right on the first try: full points</li>
            <li>Right on the second try: half points</li>
            <li>3 in a row: 50% hot-streak bonus</li>
            <li>Finish a daily lesson: +50, plus a streak bonus</li></ul>
          ${lastTest ? `<div class="kpi"><span>Last placement test (${fmtDate(lastTest.date)})</span><b>Level ${lastTest.level}</b></div>` : ''}
        </section>
      </div></div>`);
    const gt = $('#goTest'); if (gt) gt.onclick = startTest;
    const gl = $('#goLesson'); if (gl) gl.onclick = () => startLesson('lesson', S.level);
    app.querySelectorAll('[data-practice]').forEach((b) => b.addEventListener('click', () => startLesson('practice', +b.dataset.practice)));
  }

  // ---------- test tab ----------
  function renderTestTab() {
    const last = S.tests[S.tests.length - 1];
    shell(`<div class="stack" style="max-width:720px;margin-inline:auto;width:100%">
      <h1 style="font-size:2rem">Placement test</h1>
      <section class="card stack">
        <p>The test starts with Level 1 and climbs. Get 3 right at a level to move up. Miss 2 at a level and the test ends there. That's your breaking point, and it shows exactly what to work on next.</p>
        <p class="muted small">No hints during the test. Up to 40 questions, usually 15 to 25 minutes. Retake it any time to see how far you've climbed.</p>
        ${last ? `<div class="kpi"><span>Last result, ${fmtDate(last.date)}</span><b>Level ${last.level} of 10</b></div>` : ''}
        <button class="btn big" id="goTest">${last ? 'Retake the test' : 'Start the test'}</button>
      </section></div>`);
    $('#goTest').onclick = startTest;
  }

  // ---------- sessions ----------
  function startTest() {
    session = { mode: 'test', lvl: 1, c: 0, w: 0, per: [], n: 0, correct: 0, start: Date.now(), points: 0, seen: new Set() };
    nextQuestion();
  }
  function lessonPlan(mode, L) {
    if (mode === 'practice') return Array(10).fill(0).map(() => ({ lvl: L, role: 'core' }));
    const plan = [];
    if (L > 1) {
      const lower = []; for (let i = 1; i < L; i++) lower.push(i);
      const weak = lower.map((l) => { const s = S.stats[l] || { c: 0, w: 0 }; return { l, score: (s.w + 1) / (s.c + s.w + 2) + Math.random() * 0.2 }; })
        .sort((a, b) => b.score - a.score);
      for (let i = 0; i < 3; i++) plan.push({ lvl: weak[i % weak.length].l, role: 'review' });
    }
    const core = L > 1 ? 10 : 13;
    for (let i = 0; i < core; i++) plan.push({ lvl: L, role: 'core' });
    for (let i = 0; i < 2; i++) plan.push({ lvl: Math.min(10, L + 1), role: 'challenge' });
    return plan;
  }
  function startLesson(mode, L) {
    session = { mode, lvl: L, plan: lessonPlan(mode, L), i: -1, results: [], points: 0, combo: 0, start: Date.now(), seen: new Set(), learn: true };
    renderSession();
  }

  function nextQuestion() {
    const s = session;
    if (s.mode === 'test') {
      s.q = generate(s.lvl, s.seen); s.role = 'test'; s.n++;
    } else {
      s.i++;
      if (s.i >= s.plan.length) return finishLesson();
      const p = s.plan[s.i]; s.q = generate(p.lvl, s.seen); s.role = p.role;
    }
    s.tries = 0; s.input = ''; s.fb = null; s.done = false; s.wrongIdx = [];
    renderSession();
  }

  function renderSession() {
    const s = session;
    if (s.mode !== 'test' && s.learn) return renderLearn();
    if (s.result) return s.mode === 'test' ? renderTestResult() : renderLessonResult();
    const q = s.q;
    let progW, countTxt;
    if (s.mode === 'test') { progW = pct(s.lvl - 1, 10); countTxt = `Level ${s.lvl} · Question ${s.n}`; }
    else { progW = pct(s.i, s.plan.length); countTxt = `${s.i + 1} of ${s.plan.length}`; }
    const roleChip = s.role === 'review' ? '<span class="chip review">Review</span>' : s.role === 'challenge' ? '<span class="chip challenge">Challenge</span>' : '';
    const answerUI = q.kind === 'mc'
      ? `<div class="choices">${q.choices.map((c, i) => `<button class="choice ${s.wrongIdx.includes(i) ? 'wrong' : ''} ${s.done && c.ok ? 'right' : ''}" data-c="${i}" ${s.done || s.wrongIdx.includes(i) ? 'disabled' : ''}><span class="lt">${'ABCD'[i]}</span><span>${c.h}</span></button>`).join('')}</div>`
      : `<div class="stack" style="gap:10px">
          <div class="answer ${s.input ? '' : 'empty'} ${s.done ? '' : 'focus'}" id="ans" aria-live="polite">${s.input ? esc(s.input) : (q.frac ? 'Type your answer, like 3/4' : 'Type your answer')}</div>
          ${s.done ? '' : `<div class="pad">
            ${['7', '8', '9', '÷/', '4', '5', '6', '−', '1', '2', '3', '.', '0', 'del'].map((k) => {
              if (k === 'del') return `<button class="key op" data-k="del" aria-label="Delete" style="grid-column:span 2">${I.back}</button>`;
              if (k === '÷/') return `<button class="key op" data-k="/" aria-label="Fraction bar">/</button>`;
              return `<button class="key ${/[−.]/.test(k) ? 'op' : ''}" data-k="${k}">${k}</button>`;
            }).join('')}
            <button class="key check" data-k="check">Check</button></div>
            <p class="padhelp">− makes a number negative. / makes a fraction.</p>`}
        </div>`;
    shell(`
      <div class="sessbar"><button class="xbtn" id="quit" aria-label="Stop">${I.x}</button>
        <div class="meter" aria-hidden="true"><span style="width:${progW}%"></span></div><span class="count">${countTxt}</span></div>
      <div id="quitConfirm"></div>
      <div class="qgrid">
        <section class="card qcard">
          <div class="qmeta"><span class="chip">Level ${q.level} · ${q.skill}</span>${roleChip}${s.mode !== 'test' && s.combo >= 3 ? '<span class="chip challenge">Hot streak!</span>' : ''}</div>
          <p class="lead">${q.lead}</p>
          <div class="expr">${q.expr}</div>
          ${s.fb ? fbHTML(s.fb) : ''}
        </section>
        <section class="card">${answerUI}</section>
      </div>`);
    $('#quit').onclick = askQuit;
    app.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => answerMC(+b.dataset.c)));
    app.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => key(b.dataset.k)));
    const nb = $('#nextBtn'); if (nb) { nb.onclick = advance; }
    const tb = $('#tryBtn'); if (tb) tb.onclick = () => { s.fb = null; s.input = ''; renderSession(); };
    const sb = $('#stepsBtn'); if (sb) sb.onclick = () => { s.fb.showSteps = true; renderSession(); };
    const fbEl = app.querySelector('.fb'); if (fbEl && window.innerWidth < 860) fbEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function advance() {
    const s = session;
    if (s.mode === 'test' && s.testOver) { finishTest(); return; }
    nextQuestion();
  }

  function fbHTML(fb) {
    const q = session.q;
    const steps = `<ol class="steps">${q.steps.map((x) => `<li>${x}</li>`).join('')}</ol>`;
    if (fb.type === 'good') return `<div class="fb good" role="status"><h3>${pick(['Nice work!', 'You got it!', 'Correct!', 'Yes! Exactly right.', 'Great job!'])}${fb.pts ? ` <span class="plus">+${fb.pts}</span>` : ''}</h3>
        ${fb.note ? `<p>${fb.note}</p>` : ''}
        ${fb.showSteps ? steps : '<button class="linkbtn" id="stepsBtn">Show the steps</button>'}
        <button class="btn good block" id="nextBtn">Next</button></div>`;
    if (fb.type === 'warn') return `<div class="fb warn" role="status"><h3>Not quite yet. Try again!</h3>
        ${fb.why ? `<p>${fb.why}</p>` : ''}
        <div class="hint"><b>Hint:</b> ${q.hint}</div>
        ${q.kind === 'num' ? '<button class="btn block" id="tryBtn">Try again</button>' : '<p class="small muted">Pick another answer.</p>'}</div>`;
    if (fb.type === 'test-good') return `<div class="fb good" role="status"><h3>Correct!${fb.pts ? ` <span class="plus">+${fb.pts}</span>` : ''}</h3>${fb.note ? `<p>${fb.note}</p>` : ''}<button class="btn good block" id="nextBtn">${session.testOver ? 'See my results' : 'Next'}</button></div>`;
    if (fb.type === 'test-bad') return `<div class="fb bad" role="status"><h3>Not this time</h3><p>The answer is <b>${q.ansH}</b>. You'll practice this in your lessons.</p>
        ${fb.showSteps ? steps : '<button class="linkbtn" id="stepsBtn">Show the steps</button>'}
        <button class="btn block" id="nextBtn">${session.testOver ? 'See my results' : 'Next'}</button></div>`;
    return `<div class="fb bad" role="status"><h3>Let's walk through it together</h3>
        ${fb.why ? `<p>${fb.why}</p>` : ''}
        ${steps}
        <p>The answer is <b>${q.ansH}</b>.</p>
        <button class="btn block" id="nextBtn">Got it. Next</button></div>`;
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function key(k) {
    const s = session; if (s.done) return;
    if (k === 'check') return answerNum();
    if (s.fb && s.fb.type === 'warn') s.fb = null;
    if (k === 'del') s.input = s.input.slice(0, -1);
    else if (k === '−') s.input = s.input.startsWith('−') ? s.input.slice(1) : '−' + s.input;
    else if (k === '/') { if (s.input && !s.input.includes('/') && !s.input.includes('.') && /\d$/.test(s.input)) s.input += '/'; }
    else if (k === '.') { if (!s.input.includes('.') && !s.input.includes('/')) s.input += (/\d$/.test(s.input) ? '.' : '0.'); }
    else if (s.input.replace(/[^\d]/g, '').length < 9) s.input += k;
    const a = $('#ans');
    if (a && !(s.fb)) { a.textContent = s.input || (s.q.frac ? 'Type your answer, like 3/4' : 'Type your answer'); a.classList.toggle('empty', !s.input); }
    else renderSession();
  }
  document.addEventListener('keydown', (e) => {
    if (!session || session.learn || session.result || !session.q || session.q.kind !== 'num' || e.target.tagName === 'INPUT') return;
    if (session.done) { if (e.key === 'Enter') { e.preventDefault(); advance(); } return; }
    if (/^\d$/.test(e.key)) key(e.key);
    else if (e.key === '-') key('−');
    else if (e.key === '/') { e.preventDefault(); key('/'); }
    else if (e.key === '.') key('.');
    else if (e.key === 'Backspace') key('del');
    else if (e.key === 'Enter') { e.preventDefault(); if (session.fb && session.fb.type === 'warn') { session.fb = null; session.input = ''; renderSession(); } else key('check'); }
  });

  function parseAns(str) {
    const t = str.replace(/−/g, '-').trim();
    let m = t.match(/^(-?)(\d+)\/(\d+)$/);
    if (m) { const n = +m[2], d = +m[3]; if (d === 0) return null; const sg = m[1] ? -1 : 1; return { v: (sg * n) / d, frac: true, n: sg * n, d }; }
    if (/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return { v: parseFloat(t), frac: false };
    return null;
  }
  function answerNum() {
    const s = session, q = s.q;
    const p = parseAns(s.input);
    if (!p) { toast(s.input ? 'Type a number like 7, −3, 2/5 or 1.5' : 'Type your answer first'); return; }
    let ok = Math.abs(p.v - q.ans) < 1e-9, note = '';
    if (!ok && !Number.isInteger(q.ans) && !p.frac && Math.abs(p.v - q.ans) < 0.0051) { ok = true; note = `As a fraction, that's ${q.ansH}.`; }
    if (ok && p.frac && (gcd(p.n, p.d) > 1 || p.d === 1)) note = `In simplest form, that's ${q.ansH}.`;
    let why = null;
    if (!ok) {
      why = q.diag ? q.diag(p.v) : null;
      if (!why && q.ans !== 0 && Math.abs(p.v + q.ans) < 1e-9) why = 'So close! Your answer has the opposite sign. Recheck the signs at each step.';
    }
    resolve(ok, why, note);
  }
  function answerMC(i) {
    const s = session, q = s.q, c = q.choices[i];
    if (s.done || s.wrongIdx.includes(i)) return;
    if (!c.ok) s.wrongIdx.push(i);
    resolve(c.ok, c.ok ? null : c.why, '');
  }

  function trackActive() {
    const s = session; if (!s) return;
    S.active = s.mode === 'test'
      ? { mode: 'test', lvl: s.lvl > 10 ? 10 : s.lvl, answered: s.n, correct: s.correct, started: s.start, at: Date.now() }
      : { mode: s.mode, lvl: s.lvl, answered: s.results.length, of: s.plan.length, correct: s.results.filter((r) => r.first).length, started: s.start, at: Date.now() };
  }
  function resolve(ok, why, note) {
    const s = session, q = s.q;
    s.tries++;
    if (s.mode === 'test') {
      s.done = true;
      if (ok) { s.c++; s.correct++; const pts = Math.round(basePts(q.level) / 2); s.points += pts; S.points += pts; s.fb = { type: 'test-good', pts, note }; }
      else { s.w++; s.fb = { type: 'test-bad' }; }
      stat(q.level, ok);
      if (s.c >= 3) { s.per.push({ lvl: s.lvl, c: s.c, w: s.w, pass: true }); s.lvl++; s.c = 0; s.w = 0; if (s.lvl > 10) { s.testOver = true; s.final = 10; } }
      else if (s.w >= 2) { s.per.push({ lvl: s.lvl, c: s.c, w: s.w, pass: false }); s.testOver = true; s.final = s.lvl - 1; }
      trackActive(); save(); renderSession(); return;
    }
    if (ok) {
      const first = s.tries === 1;
      if (first) s.combo++; else s.combo = 0;
      let pts = first ? basePts(q.level) : Math.round(basePts(q.level) / 2);
      if (first && s.combo >= 3) pts = Math.round(pts * 1.5);
      s.points += pts; S.points += pts;
      s.results.push({ lvl: q.level, role: s.role, first, ok: true });
      stat(q.level, first); trackActive();
      s.done = true; s.fb = { type: 'good', pts, note: note || (s.tries > 1 ? 'You fixed it. That is exactly how you learn this stuff.' : '') };
      save();
    } else if (s.tries === 1) {
      s.combo = 0; s.fb = { type: 'warn', why };
    } else {
      s.results.push({ lvl: q.level, role: s.role, first: false, ok: false });
      stat(q.level, false); trackActive();
      s.done = true; s.fb = { type: 'bad', why };
      save();
    }
    renderSession();
  }

  function askQuit() {
    const box = $('#quitConfirm');
    if (box.innerHTML) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="confirm" style="margin-bottom:14px"><b>Stop now?</b><p class="small">${session.mode === 'test' ? "This test won't be saved. You can start it again any time." : 'Points you earned so far are kept, but the lesson will not count toward leveling up.'}</p>
      <div class="row"><button class="btn danger" id="quitYes">Stop</button><button class="btn ghost" id="quitNo">Keep going</button></div></div>`;
    $('#quitYes').onclick = () => { session = null; if (S.active) { delete S.active; save(); } render(); };
    $('#quitNo').onclick = () => { box.innerHTML = ''; };
  }

  // ---------- lesson intro ----------
  function renderLearn() {
    const s = session, L = LEVELS[s.lvl - 1];
    shell(`<div class="stack" style="max-width:760px;margin-inline:auto;width:100%">
      <div class="sessbar"><button class="xbtn" id="quit" aria-label="Stop">${I.x}</button><div class="meter"><span style="width:0%"></span></div><span class="count">${s.plan.length} problems</span></div>
      <div id="quitConfirm"></div>
      <section class="card learn stack">
        <span class="eyebrow">${s.mode === 'practice' ? 'Extra practice' : "Today's skill"} · Level ${L.n}</span>
        <h2>${L.name}</h2>
        <p>${L.card.idea}</p>
        <div class="ex">${L.card.ex.map((e) => `<div>${esc(e)}</div>`).join('')}</div>
        <p class="tip"><b>Tip:</b> ${esc(L.card.tip)}</p>
        ${s.mode === 'lesson' && s.lvl > 1 ? '<p class="small muted">First a few review problems, then today\'s skill, then 2 challenge problems from the next level.</p>' : ''}
        <button class="btn big" id="learnGo">I'm ready</button>
      </section></div>`);
    $('#quit').onclick = askQuit;
    $('#learnGo').onclick = () => { s.learn = false; nextQuestion(); };
  }

  // ---------- finish ----------
  function finishTest() {
    const s = session, level = s.final;
    const rec = { date: Date.now(), level, correct: s.correct, total: s.n, secs: Math.round((Date.now() - s.start) / 1000), per: s.per };
    S.tests.push(rec); delete S.active;
    const target = Math.min(10, Math.max(1, level + 1));
    if (!S.placed) { S.level = target; S.placed = true; S.strong = 0; }
    else if (target > S.level) { S.level = target; S.strong = 0; }
    save();
    s.result = rec; renderSession(); confetti();
  }
  function renderTestResult() {
    const r = session.result, prev = S.tests.length > 1 ? S.tests[S.tests.length - 2] : null;
    const msg = r.level === 0 ? "Level 1 is the place to start. That's great news, because the basics are where everything else gets easier."
      : r.level === 10 ? 'You cleared every level. Amazing! Your lessons will keep the hardest skills sharp.'
      : `You're solid through Level ${r.level}: ${lvlName(r.level)}. Your next climb is Level ${r.level + 1}: ${lvlName(r.level + 1)}.`;
    shell(`<div class="stack" style="max-width:760px;margin-inline:auto;width:100%">
      <section class="card stack">
        <span class="eyebrow">Placement test result</span>
        <div class="big-level"><div class="badge"><div><b>${r.level}</b><span>${r.level === 1 ? 'level' : 'levels'} passed</span></div></div>
          <div class="stack" style="gap:6px;flex:1;min-width:220px"><h2 style="font-size:1.6rem">${r.level === 0 ? 'Starting at Level 1' : `Level ${r.level} reached!`}</h2><p>${msg}</p>
          ${prev ? `<p class="small muted">Last time: Level ${prev.level}. ${r.level > prev.level ? `Up ${r.level - prev.level} level${r.level - prev.level > 1 ? 's' : ''}!` : r.level === prev.level ? 'Same as before.' : 'A bit lower this time, and that happens. Lessons stay at your best level.'}</p>` : ''}</div></div>
        <div class="kpis"><div class="kpi"><b>${r.correct}/${r.total}</b><span>Correct</span></div><div class="kpi"><b>${fmtMins(r.secs * 1000)}</b><span>Time</span></div><div class="kpi"><b>+${session.points}</b><span>Points</span></div></div>
        <div class="tablewrap"><table><thead><tr><th>Level</th><th>Skill</th><th>Right</th><th>Missed</th><th></th></tr></thead><tbody>
          ${r.per.map((p) => `<tr><td>${p.lvl}</td><td>${lvlName(p.lvl)}</td><td>${p.c}</td><td>${p.w}</td><td style="color:var(${p.pass ? '--good' : '--bad'});font-weight:700">${p.pass ? 'Passed' : 'Breaking point'}</td></tr>`).join('')}
        </tbody></table></div>
        <button class="btn big" id="doneBtn">Go to my lessons</button>
      </section></div>`);
    $('#doneBtn').onclick = () => { session = null; tab = 'home'; render(); };
  }

  function finishLesson() {
    const s = session;
    const core = s.results.filter((r) => r.role === 'core');
    const coreFirst = core.filter((r) => r.first).length;
    const acc = pct(coreFirst, core.length);
    let bonus = 0, leveled = false, msg = '';
    if (s.mode === 'lesson') {
      const today = dayKey();
      if (S.streak.last !== today) { S.streak.count = S.streak.last === yesterdayKey() ? S.streak.count + 1 : 1; S.streak.last = today; }
      bonus = 50 + Math.min(100, 10 * S.streak.count);
      if (S.level < 10) {
        if (acc >= 80) { S.strong++; if (S.strong >= 2) { S.level++; S.strong = 0; leveled = true; } }
        else if (acc < 50) S.strong = 0;
      }
      msg = leveled ? `You leveled up to Level ${S.level}: ${lvlName(S.level)}!`
        : S.level >= 10 ? 'You are at the top level. Keep it up!'
        : acc >= 80 ? `Strong lesson! ${S.strong} of 2 toward Level ${S.level + 1}.`
        : acc >= 50 ? `Good work. Get 8 of 10 on the first try in a lesson to count it toward Level ${S.level + 1}.`
        : 'This skill is still new, and that is okay. Tomorrow\'s lesson will give it another round.';
    } else {
      msg = acc >= 80 ? 'Great practice! This level looks solid.' : 'Nice effort. Practice like this is how it sticks.';
    }
    S.points += bonus; s.points += bonus;
    const rec = { date: Date.now(), day: dayKey(), mode: s.mode, level: s.lvl, total: s.results.length, first: s.results.filter((r) => r.first).length, acc, points: s.points, secs: Math.round((Date.now() - s.start) / 1000) };
    S.lessons.push(rec); delete S.active;
    save();
    s.result = { rec, msg, leveled, bonus };
    renderSession();
    if (leveled || acc >= 80) confetti();
  }
  function renderLessonResult() {
    const { rec, msg, leveled, bonus } = session.result;
    shell(`<div class="stack" style="max-width:760px;margin-inline:auto;width:100%"><section class="card stack">
      <span class="eyebrow">${rec.mode === 'practice' ? 'Practice' : 'Lesson'} complete</span>
      <h2 style="font-size:1.9rem">${leveled ? 'Level up!' : rec.acc >= 80 ? 'Awesome lesson!' : 'Lesson done. Nice work!'}</h2>
      <p>${msg}</p>
      <div class="kpis"><div class="kpi"><b>+${rec.points}</b><span>Points${bonus ? ` (incl. +${bonus} bonus)` : ''}</span></div>
        <div class="kpi"><b>${rec.first}/${rec.total}</b><span>Right on the first try</span></div>
        <div class="kpi"><b>${fmtMins(rec.secs * 1000)}</b><span>Time</span></div>
        ${rec.mode === 'lesson' ? `<div class="kpi"><b>${S.streak.count}</b><span>Day streak</span></div>` : ''}</div>
      <div class="row"><button class="btn big" id="doneBtn">Back to Today</button>${rec.mode === 'lesson' ? '<button class="btn ghost" id="moreBtn">Bonus round</button>' : ''}</div>
    </section></div>`);
    $('#doneBtn').onclick = () => { session = null; tab = 'home'; render(); };
    const mb = $('#moreBtn'); if (mb) mb.onclick = () => { startLesson('practice', S.level); session.learn = false; nextQuestion(); };
  }

  // ---------- scores ----------
  function chartSVG(tests) {
    const W = 340, H = 170, l = 30, r = 12, t = 12, b = 26;
    const n = tests.length, xs = (i) => (n === 1 ? (l + W - r) / 2 : l + (i * (W - l - r)) / (n - 1)), ys = (v) => t + ((10 - v) * (H - t - b)) / 10;
    const grid = [0, 2, 4, 6, 8, 10].map((v) => `<line x1="${l}" x2="${W - r}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)" stroke-width="1"/><text x="${l - 8}" y="${ys(v) + 4}" text-anchor="end">${v}</text>`).join('');
    const pts = tests.map((x, i) => `${xs(i)},${ys(x.level)}`).join(' ');
    const area = n > 1 ? `<polygon points="${xs(0)},${ys(0)} ${pts} ${xs(n - 1)},${ys(0)}" fill="var(--accent)" opacity="0.12"/>` : '';
    const dots = tests.map((x, i) => `<circle cx="${xs(i)}" cy="${ys(x.level)}" r="${i === n - 1 ? 6 : 4}" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>`).join('');
    const labels = tests.map((x, i) => (n <= 6 || i === 0 || i === n - 1) ? `<text x="${xs(i)}" y="${H - 6}" text-anchor="middle">${new Date(x.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>` : '').join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Placement test level over time">${grid}${area}${n > 1 ? `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round"/>` : ''}${dots}${labels}</svg>`;
  }
  function activeHTML() {
    const a = S.active; if (!a) return '';
    const live = Date.now() - a.at < 30 * 60000;
    const what = a.mode === 'test' ? 'Placement test' : a.mode === 'lesson' ? 'Daily lesson' : 'Extra practice';
    const where = `Level ${a.lvl}: ${lvlName(a.lvl)}`;
    const count = a.mode === 'test' ? `${a.correct} of ${a.answered} right so far` : `${a.answered} of ${a.of} problems done, ${a.correct} right on the first try`;
    const ago = Math.max(1, Math.round((Date.now() - a.at) / 60000));
    const note = a.mode === 'test' ? 'The test result and lesson level are saved when the test ends.' : 'The lesson shows up below when she finishes.';
    return live
      ? `<section class="card stack" style="border:2px solid var(--accent);background:var(--accent-soft)"><span class="eyebrow" style="color:var(--accent)">In progress now</span>
          <h3>${what}: on ${where}</h3><p>${count}. Last answer ${ago} min ago. ${note}</p></section>`
      : `<section class="card stack"><span class="eyebrow">Unfinished</span><h3>${what} stopped on ${where}</h3>
          <p class="muted">${count}, last answer ${fmtDate(a.at)}. It wasn't finished, so it doesn't count as a result.</p></section>`;
  }
  function renderScores() {
    const T = S.tests, Ls = S.lessons.slice().reverse();
    const best = T.reduce((m, x) => Math.max(m, x.level), 0);
    const totalQs = S.lessons.reduce((a, x) => a + x.total, 0);
    const totalMin = Math.round(S.lessons.reduce((a, x) => a + x.secs, 0) / 60);
    shell(`<div class="stack">
      <h1 style="font-size:2rem">Scores</h1>
      ${activeHTML()}
      <div class="kpis">
        <div class="kpi"><b>${S.points.toLocaleString()}</b><span>Total points</span></div>
        <div class="kpi"><b>${S.level}</b><span>Lesson level</span></div>
        <div class="kpi"><b>${best}</b><span>Best test level</span></div>
        <div class="kpi"><b>${S.lessons.length}</b><span>Lessons done</span></div>
        <div class="kpi"><b>${totalQs}</b><span>Problems solved</span></div>
        <div class="kpi"><b>${totalMin}</b><span>Minutes practiced</span></div>
      </div>
      <div class="grid2">
        <section class="card stack chart"><div><span class="eyebrow">Placement tests</span><h3 style="margin-top:4px">Level reached over time</h3></div>
          ${T.length ? chartSVG(T) : '<div class="empty-note">No tests yet. Take the placement test to see your starting level here.</div>'}
          ${T.length ? `<div class="tablewrap"><table><thead><tr><th>Date</th><th>Level</th><th>Correct</th><th>Time</th></tr></thead><tbody>
            ${T.slice().reverse().map((x) => `<tr><td>${fmtDate(x.date)}</td><td><b>${x.level}</b> / 10</td><td>${x.correct}/${x.total}</td><td>${fmtMins(x.secs * 1000)}</td></tr>`).join('')}</tbody></table></div>` : ''}
          <button class="btn ghost" id="retake">${T.length ? 'Retake the test' : 'Take the test'}</button>
        </section>
        <section class="card stack"><div><span class="eyebrow">Skills</span><h3 style="margin-top:4px">First-try accuracy by level</h3></div>
          <div class="ladder">${LEVELS.map((L) => { const s = S.stats[L.n]; const n = s ? s.c + s.w : 0; const a = pct(s ? s.c : 0, n);
            return `<div class="rung" style="grid-template-columns:34px 1fr 64px"><b>${L.n}</b><div style="display:grid;gap:4px;min-width:0"><span class="small">${L.name}</span><div class="meter" style="height:8px"><span style="width:${a}%;background:var(${a >= 80 ? '--good' : a >= 50 ? '--gold' : '--bad'})"></span></div></div><span class="small" style="text-align:right">${n ? a + '%' : '–'}</span></div>`; }).join('')}</div>
        </section>
      </div>
      <section class="card stack"><div><span class="eyebrow">Lessons</span><h3 style="margin-top:4px">Recent lessons and practice</h3></div>
        ${Ls.length ? `<div class="tablewrap"><table><thead><tr><th>Date</th><th>Type</th><th>Level</th><th>First try</th><th>Points</th><th>Time</th></tr></thead><tbody>
          ${Ls.slice(0, 40).map((x) => `<tr><td>${fmtDate(x.date)}</td><td>${x.mode === 'lesson' ? 'Lesson' : 'Practice'}</td><td>${x.level}</td><td>${x.first}/${x.total} (${pct(x.first, x.total)}%)</td><td>+${x.points}</td><td>${fmtMins(x.secs * 1000)}</td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty-note">Lessons you finish will show up here with points and accuracy.</div>'}
      </section></div>`);
    $('#retake').onclick = startTest;
  }

  // ---------- settings ----------
  function personalLink() { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('code', code); return u.toString(); }
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (e) { toast('Select the text and copy it'); } }
  function renderSettings() {
    const backup = (() => { try { return 'CLIMB1:' + btoa(unescape(encodeURIComponent(JSON.stringify(S)))); } catch (e) { return ''; } })();
    shell(`<div class="stack" style="max-width:760px;margin-inline:auto;width:100%">
      <h1 style="font-size:2rem">Settings</h1>
      <section class="card stack"><h3>Name</h3>
        <div class="row" style="flex-wrap:nowrap"><input type="text" id="nameEdit" maxlength="24" value="${esc(S.name)}"><button class="btn" id="nameSave">Save</button></div></section>
      ${CLOUD ? `<section class="card stack"><h3>Use on another device</h3>
        <p class="muted small">Open this personal link once on each iPad, iPhone or computer. Progress saves online and follows you. Keep it private, like a password.</p>
        <div class="code" id="plink">${esc(personalLink())}</div>
        <div class="row"><button class="btn" id="copyLink">Copy link</button></div>
        <p class="small muted">Family code: <span class="code" style="display:inline-block;padding:2px 8px">${esc(code)}</span></p></section>`
      : `<section class="card stack"><h3>Saved on this device</h3><p class="muted small">Progress is stored in this browser. Use a backup code below to move it to another device.</p></section>`}
      <section class="card stack"><h3>Backup code</h3>
        <p class="muted small">A copy of all progress as text. Keep it somewhere safe, or paste it on another device to restore.</p>
        <textarea id="bk" readonly>${esc(backup)}</textarea>
        <div class="row"><button class="btn ghost" id="copyBk">Copy backup</button></div>
        <label class="small" for="restoreIn">Restore from a backup code</label>
        <textarea id="restoreIn" placeholder="Paste a backup code that starts with CLIMB1:"></textarea>
        <div class="row"><button class="btn ghost" id="restoreBtn">Restore</button></div><div id="restoreBox"></div></section>
      <section class="card stack"><h3>Start over</h3><p class="muted small">Erase all scores, points and levels.</p>
        <div class="row"><button class="btn danger" id="resetBtn">Erase progress</button></div><div id="resetBox"></div></section>
    </div>`);
    $('#nameSave').onclick = () => { const n = $('#nameEdit').value.trim(); if (n) { S.name = n; save(); toast('Saved'); } };
    const cl = $('#copyLink'); if (cl) cl.onclick = () => copy(personalLink());
    $('#copyBk').onclick = () => copy(backup);
    $('#restoreBtn').onclick = () => {
      const raw = $('#restoreIn').value.trim();
      let data = null;
      try { if (raw.startsWith('CLIMB1:')) data = JSON.parse(decodeURIComponent(escape(atob(raw.slice(7))))); } catch (e) { data = null; }
      if (!data || !Array.isArray(data.tests)) { $('#restoreBox').innerHTML = '<p class="small" style="color:var(--bad)">That code didn\'t work. Copy the whole thing, starting with CLIMB1:</p>'; return; }
      $('#restoreBox').innerHTML = `<div class="confirm"><b>Replace current progress?</b><p class="small">This swaps in the backup (${data.tests.length} tests, ${(data.lessons || []).length} lessons, ${(data.points || 0).toLocaleString()} points).</p><div class="row"><button class="btn danger" id="rYes">Replace</button><button class="btn ghost" id="rNo">Cancel</button></div></div>`;
      $('#rYes').onclick = () => { S = Object.assign(blank(), data); save(); toast('Restored'); render(); };
      $('#rNo').onclick = () => { $('#restoreBox').innerHTML = ''; };
    };
    $('#resetBtn').onclick = () => {
      $('#resetBox').innerHTML = `<div class="confirm"><b>Erase everything?</b><p class="small">This can't be undone. Copy the backup code first if you might want it later.</p><div class="row"><button class="btn danger" id="xYes">Erase</button><button class="btn ghost" id="xNo">Cancel</button></div></div>`;
      $('#xYes').onclick = () => { const name = S.name; S = blank(); S.name = name; save(); tab = 'home'; render(); };
      $('#xNo').onclick = () => { $('#resetBox').innerHTML = ''; };
    };
  }

  // ---------- boot ----------
  const local = readLocal();
  if (local) S = local;
  render();
  pull();
})();
