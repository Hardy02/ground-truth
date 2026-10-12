// Ground Truth case player. Vanilla JS, data in cases/<slug>/<mode>.json.
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
  return el;
}
const paras = t => String(t).split(/\n\n+/).map(p => h('p', {}, p));

const params = new URLSearchParams(location.search);
const slug = params.get('case');
let mode = params.get('mode');
let C, items = [], current = null;
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(`gt:${slug}:${mode}:${k}`)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`gt:${slug}:${mode}:${k}`, JSON.stringify(v)); } catch {} },
};

async function boot() {
  if (!slug) return location.replace('index.html');
  const lib = await (await fetch('cases/index.json')).json();
  const meta = lib.cases.find(c => c.slug === slug);
  if (!meta) return fail('That case does not exist. Go back to the library and pick one.');
  document.title = `${meta.title} · Ground Truth`;
  if (!mode || !meta.modes.some(m => m.id === mode)) return pickMode(meta);
  C = await (await fetch(`cases/${slug}/${mode}.json`)).json();
  items = [...C.items];
  for (const code of store.get('codes', [])) await applyCode(code, true);
  desk(meta);
}
function fail(msg) { document.body.replaceChildren(h('main', { class: 'fail' }, h('p', {}, msg), h('a', { href: 'index.html' }, 'Back to the library'))); }

/* ---------- mode picker ---------- */
function pickMode(meta) {
  document.body.className = 'picker';
  document.body.replaceChildren(h('main', { class: 'pick' },
    h('a', { class: 'back', href: 'index.html' }, '← Library'),
    h('header', {},
      h('img', { class: 'pick-cover', src: `cases/${slug}/${meta.cover}`, alt: '' }),
      h('div', {}, h('p', { class: 'kicker' }, `${meta.place} · ${meta.date}`), h('h1', {}, meta.title), h('p', { class: 'lede' }, meta.blurb))),
    h('div', { class: 'modes' }, meta.modes.map(m => h('a', { class: `mode mode-${m.id}`, href: `case.html?case=${slug}&mode=${m.id}` },
      h('h2', {}, m.name), h('p', { class: 'ai' }, m.ai), h('p', {}, m.about),
      m.warn && h('p', { class: 'warn' }, m.warn), h('span', { class: 'go' }, 'Open the file')))),
  ));
}

/* ---------- desk ---------- */
function desk(meta) {
  document.body.className = `desk-body m-${mode}`;
  const m = meta.modes.find(x => x.id === mode);
  const tray = h('nav', { class: 'tray', 'aria-label': 'Evidence' });
  const viewer = h('section', { class: 'viewer', tabindex: '-1' });
  const notes = h('textarea', { class: 'notes', placeholder: 'Your notes save automatically on this device.', 'aria-label': 'Your notes', oninput: e => store.set('notes', e.target.value) });
  notes.value = store.get('notes', '');
  document.body.replaceChildren(
    h('header', { class: 'bar' },
      h('a', { class: 'brand', href: 'index.html' }, 'Ground Truth'),
      h('div', { class: 'bar-title' }, h('strong', {}, meta.title), h('span', { class: `badge badge-${mode}` }, m.name)),
      h('div', { class: 'bar-actions' },
        h('button', { class: 'only-narrow', onclick: () => document.body.classList.toggle('show-tray') }, 'Evidence'),
        C.sealed && h('button', { onclick: requests }, 'Request records'),
        h('button', { onclick: () => document.body.classList.toggle('show-notes') }, 'Notes'),
        h('button', { class: 'accuse', onclick: accuse }, 'Make your accusation'))),
    h('div', { class: 'desk' }, tray, viewer, h('aside', { class: 'side' }, h('h2', {}, 'Your notes'), notes,
      h('p', { class: 'small' }, 'Notes stay in this browser only. Nothing is sent anywhere.'))));
  drawTray();
  open(params.get('item') || store.get('last', items[0].id));
}

function drawTray() {
  const seen = store.get('seen', []), tray = $('.tray');
  const groups = [...new Set(items.map(i => i.group))];
  tray.replaceChildren(...groups.map(g => h('div', { class: 'grp' }, h('h3', {}, g),
    items.filter(i => i.group === g).map(i => h('button', {
      class: `ev ${seen.includes(i.id) ? 'seen' : ''} ${current === i.id ? 'on' : ''} ${i.unlocked ? 'fresh' : ''}`,
      'data-id': i.id, onclick: () => { open(i.id); document.body.classList.remove('show-tray'); },
    }, h('span', { class: `ico ico-${i.kind}`, 'aria-hidden': 'true' }), h('span', { class: 'ev-t' }, i.title, i.sub && h('small', {}, i.sub)))))));
}

function open(id) {
  const it = items.find(i => i.id === id) || items[0];
  current = it.id; store.set('last', it.id);
  const seen = store.get('seen', []); if (!seen.includes(it.id)) { seen.push(it.id); store.set('seen', seen); }
  const v = $('.viewer');
  v.replaceChildren(h('div', { class: 'viewer-inner' }, (R[it.kind] || R.doc)(it)));
  v.scrollTop = 0; v.focus({ preventScroll: true });
  drawTray();
}

/* ---------- renderers ---------- */
const blocks = bs => (bs || []).map(b => {
  if (typeof b === 'string') return paras(b);
  if (b.h) return h('h3', {}, b.h);
  if (b.kv) return h('dl', { class: 'kv' }, b.kv.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
  if (b.table) return h('div', { class: 'tbl' }, h('table', {}, h('thead', {}, h('tr', {}, b.table.cols.map(c => h('th', {}, c)))),
    h('tbody', {}, b.table.rows.map(r => h('tr', {}, r.map(c => h('td', {}, c)))))));
  if (b.quote) return h('blockquote', {}, paras(b.quote));
  if (b.list) return h('ul', {}, b.list.map(x => h('li', {}, x)));
  if (b.note) return h('p', { class: 'note' }, b.note);
  if (b.img) return h('figure', {}, h('img', { src: asset(b.img), alt: b.alt || b.cap || '', loading: 'lazy' }), b.cap && h('figcaption', {}, b.cap));
  if (b.sig) return h('p', { class: 'sig' }, b.sig);
  if (b.hr) return h('hr');
  return null;
});
const asset = p => /^https?:/.test(p) ? p : `cases/${slug}/${p}`;

const R = {
  doc(it) {
    return h('article', { class: `paper paper-${it.style || 'report'}` },
      it.letterhead && h('div', { class: 'letterhead' }, it.letterhead),
      h('header', {}, it.ref && h('p', { class: 'ref' }, it.ref), h('h1', {}, it.heading || it.title), it.meta && h('dl', { class: 'kv' }, it.meta.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))),
      blocks(it.body));
  },
  statement(it) {
    return h('article', { class: 'paper paper-mg11' },
      h('div', { class: 'form-top' }, h('span', {}, 'WITNESS STATEMENT'), h('span', {}, it.ref || '')),
      h('dl', { class: 'kv form' }, [['Statement of', it.name], ['Age', it.age], ['Occupation', it.occupation], ['Taken', it.taken]]
        .filter(r => r[1]).map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
      h('div', { class: 'typed' }, paras(it.text)),
      it.note && h('p', { class: 'note' }, it.note));
  },
  email(it) {
    return h('article', { class: 'mail' },
      h('header', {}, h('h1', {}, it.subject), h('dl', { class: 'kv' }, [['From', it.from], ['To', it.to], ['Date', it.date]].map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))),
      it.thread ? it.thread.map(m => h('section', { class: 'mail-msg' }, h('p', { class: 'mail-meta' }, `${m.from} · ${m.date}`), paras(m.text))) : h('div', { class: 'mail-body' }, paras(it.text)));
  },
  notebook(it) {
    return h('article', { class: 'notebook' }, it.intro && h('p', { class: 'note nb-intro' }, it.intro),
      it.pages.map(p => h('section', { class: 'nb-page' }, h('h2', {}, p.date), h('div', { class: 'hand' }, paras(p.text)))));
  },
  gallery(it) {
    return h('article', { class: 'gallery' }, h('h1', {}, it.title), it.intro && h('p', { class: 'lede' }, it.intro),
      it.images.map(g => h('figure', {}, h('img', { src: asset(g.src), alt: g.alt || g.cap, loading: 'lazy' }), h('figcaption', {}, g.cap, g.credit && h('small', {}, g.credit)))));
  },
  phone, doorbell, map: mapView,
};
R.cctv = doorbell;

/* phone */
function phone(it) {
  let app = 0, sub = null;
  const screen = h('div', { class: 'screen' });
  const frame = h('div', { class: `phone phone-${it.os || 'ios'}` },
    h('div', { class: 'status' }, h('span', {}, it.clock || '9:41'), h('span', { class: 'notch' }), h('span', {}, '▂▄▆ 5G')), screen,
    h('nav', { class: 'dock' }, it.apps.map((a, i) => h('button', { class: 'app-btn', onclick: () => { app = i; sub = null; draw(); } }, h('span', { class: `app-ico app-${a.type}` }), a.name))));
  function draw() {
    const a = it.apps[app];
    [...frame.querySelectorAll('.app-btn')].forEach((b, i) => b.classList.toggle('on', i === app));
    screen.replaceChildren(PH[a.type](a, s => { sub = s; draw(); }, sub));
    screen.scrollTop = a.type === 'chats' && sub != null ? screen.scrollHeight : 0;
  }
  draw();
  return h('div', { class: 'phone-wrap' }, h('div', { class: 'phone-cap' }, h('h1', {}, it.title), it.caption && h('p', {}, it.caption)), frame);
}
const PH = {
  chats(a, go, sub) {
    if (sub == null) return h('div', { class: 'list' }, h('h2', { class: 'app-title' }, a.name),
      a.chats.map((c, i) => h('button', { class: 'row', onclick: () => go(i) }, h('span', { class: 'av' }, c.contact[0]),
        h('span', { class: 'row-t' }, h('b', {}, c.contact), h('small', {}, last(c))))));
    const c = a.chats[sub];
    return h('div', { class: `chat chat-${a.style || 'wa'}` },
      h('div', { class: 'chat-head' }, h('button', { class: 'back-btn', onclick: () => go(null), 'aria-label': 'Back to chats' }, '‹'), h('span', { class: 'av' }, c.contact[0]), h('b', {}, c.contact), c.number && h('small', {}, c.number)),
      h('div', { class: 'bubbles' }, c.messages.map(m => [
        m.day && h('div', { class: 'day' }, m.day),
        m.call ? h('div', { class: `callmsg ${m.me ? 'me' : ''}` }, `📹 ${m.call}`, h('time', {}, m.t)) :
          h('div', { class: `bub ${m.me ? 'me' : ''}` }, m.img && h('img', { src: asset(m.img), alt: m.alt || 'Photo' }), m.text && h('span', {}, m.text), h('time', {}, m.t, m.me && a.style !== 'sms' ? ' ✓✓' : ''))])));
  },
  calls(a) {
    return h('div', { class: 'list' }, h('h2', { class: 'app-title' }, a.name), a.entries.map(e => h('div', { class: `row call ${e.dir}` },
      h('span', { class: 'call-ico' }, e.media === 'video' ? '📹' : e.dir === 'missed' ? '↙' : e.dir === 'in' ? '↙' : '↗'),
      h('span', { class: 'row-t' }, h('b', {}, e.name), h('small', {}, [e.dirLabel || ({ out: 'Outgoing', in: 'Incoming', missed: 'Missed' })[e.dir], e.media === 'video' ? 'video call' : 'call', e.dur ? `· ${e.dur}` : ''].join(' '))),
      h('time', {}, e.when))));
  },
  photos(a, go, sub) {
    if (sub == null) return h('div', { class: 'list' }, h('h2', { class: 'app-title' }, a.name),
      h('div', { class: 'grid' }, a.items.map((p, i) => h('button', { class: 'thumb', onclick: () => go(i), 'aria-label': p.name }, h('img', { src: asset(p.src), alt: '' }), p.video && h('span', { class: 'vid' }, '▶ ' + p.video)))));
    const p = a.items[sub];
    return h('div', { class: 'photo' }, h('div', { class: 'chat-head' }, h('button', { class: 'back-btn', onclick: () => go(null), 'aria-label': 'Back to photos' }, '‹'), h('b', {}, p.name)),
      h('img', { src: asset(p.src), alt: p.desc }),
      h('details', { class: 'info', open: true }, h('summary', {}, 'ⓘ Info'), h('dl', { class: 'kv' }, (p.info || []).map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))),
      p.desc && h('p', { class: 'note' }, p.desc));
  },
  list(a) {
    return h('div', { class: 'list' }, h('h2', { class: 'app-title' }, a.name), a.rows.map(r => h('div', { class: 'row' }, h('span', { class: 'row-t' }, h('b', {}, r[0]), r[1] && h('small', {}, r[1])), r[2] && h('time', {}, r[2]))));
  },
};
const last = c => { const m = c.messages[c.messages.length - 1]; return m.call || m.text || 'Photo'; };

/* doorbell / cctv */
function doorbell(it) {
  let open = null;
  const list = h('div', { class: 'db-list' });
  function draw() {
    list.replaceChildren(...it.events.map((e, i) => h('div', { class: `db-ev ${open === i ? 'open' : ''}` },
      h('button', { class: 'db-row', onclick: () => { open = open === i ? null : i; draw(); }, 'aria-expanded': open === i },
        e.still ? h('img', { class: 'db-thumb', src: asset(e.still), alt: '' }) : h('span', { class: `db-dot t-${(e.type || '').toLowerCase()}` }),
        h('span', { class: 'db-time' }, e.time), h('span', { class: 'db-meta' }, h('b', {}, e.type), h('small', {}, `${e.date} · Event ${e.id}`)), h('span', { class: 'db-desc' }, e.desc)),
      open === i && h('div', { class: 'db-detail' }, e.still && h('img', { src: asset(e.still), alt: e.desc }),
        h('dl', { class: 'kv' }, [['Event ID', e.id], ['Date', e.date], ['Time', e.time], ['Type', e.type], ['Officer\'s description', e.desc]].map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))))));
  }
  draw();
  return h('article', { class: `app-sheet ${it.kind}` }, h('header', {}, h('p', { class: 'ref' }, it.ref || ''), h('h1', {}, it.title), h('p', {}, it.address)),
    it.intro && h('p', { class: 'note' }, it.intro),
    it.info && h('dl', { class: 'kv sysinfo' }, it.info.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])), list);
}

/* map */
function mapView(it) {
  const box = h('div', { class: 'map', id: 'map' }), out = h('p', { class: 'measure' }, 'Click two points on the map to measure a straight-line distance.');
  setTimeout(() => {
    if (!window.L) { box.textContent = 'The map could not load. Check your connection and reopen this exhibit.'; return; }
    const m = L.map(box).setView(it.center, it.zoom);
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m);
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri' });
    L.control.layers({ Map: osm, Satellite: sat }).addTo(m);
    for (const p of it.markers) L.marker(p.at).addTo(m).bindTooltip(p.label, { permanent: !!p.pin, direction: 'top' }).bindPopup(`<b>${p.label}</b>${p.note ? '<br>' + p.note : ''}`);
    let pts = [], layer = L.layerGroup().addTo(m);
    m.on('click', e => {
      pts.push(e.latlng); if (pts.length > 2) { pts = [e.latlng]; layer.clearLayers(); }
      L.circleMarker(e.latlng, { radius: 4, color: '#e9a23b' }).addTo(layer);
      if (pts.length === 2) { L.polyline(pts, { color: '#e9a23b', dashArray: '6 6' }).addTo(layer); const d = pts[0].distanceTo(pts[1]); out.textContent = `Straight line: ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(2) + ' km'}. Click again to start a new measurement.`; }
    });
  }, 0);
  return h('article', { class: 'map-sheet' }, h('h1', {}, it.title), it.intro && h('p', { class: 'note' }, it.intro), box, out);
}

/* ---------- requests (sealed evidence) ---------- */
async function applyCode(code, quiet) {
  const hits = await GT.unlock(code, C.sealed);
  let added = [];
  for (const bundle of hits) for (const it of bundle.items) if (!items.some(x => x.id === it.id)) { it.unlocked = true; items.push(it); added.push(it); }
  if (hits.length && !quiet) { const codes = store.get('codes', []); const n = GT.norm(code); if (!codes.includes(n)) { codes.push(n); store.set('codes', codes); } }
  return { hits, added };
}
function requests() {
  const out = h('div', { class: 'req-out', role: 'status' });
  const input = h('input', { type: 'text', placeholder: 'e.g. an exhibit reference, phone number or postcode', 'aria-label': 'Reference to request', autocomplete: 'off' });
  const done = store.get('codes', []);
  const dlg = modal('Request records', [
    h('p', {}, C.sealed.help),
    h('form', { class: 'req', onsubmit: async e => {
      e.preventDefault(); if (!input.value.trim()) return;
      out.textContent = 'Checking with the disclosure officer…';
      const { hits, added } = await applyCode(input.value);
      if (!hits.length) { out.textContent = `Nothing is held under “${input.value}”. Check the reference exactly as it appears, or try another kind of identifier.`; return; }
      out.replaceChildren(h('p', {}, added.length ? `Received ${added.length} new item${added.length > 1 ? 's' : ''}. They're in your evidence tray.` : 'You already have everything held under that reference.'),
        ...added.map(a => h('button', { class: 'link', onclick: () => { dlg.close(); open(a.id); } }, `Open: ${a.title}`)));
      input.value = ''; drawTray();
    } }, input, h('button', { type: 'submit' }, 'Request')),
    out,
    done.length ? h('p', { class: 'small' }, `You've requested ${done.length} reference${done.length > 1 ? 's' : ''} so far.`) : null,
  ]);
  input.focus();
}

/* ---------- accusation ---------- */
function accuse() {
  const sels = C.questions.map(q => h('select', { 'data-q': q.id, required: true, 'aria-label': q.label },
    h('option', { value: '' }, 'Choose…'), q.options.map(o => h('option', { value: o }, o))));
  const out = h('div', { class: 'req-out', role: 'status' });
  const pass = h('input', { type: 'text', placeholder: 'Reveal key', 'aria-label': 'Reveal key', autocomplete: 'off' });
  const dlg = modal('Make your accusation', [
    h('p', {}, 'Answer every question. Only a fully correct accusation unseals the solution. You won\'t be told which parts are wrong.'),
    h('form', { class: 'acc', onsubmit: async e => {
      e.preventDefault();
      const ans = C.questions.map((q, i) => `${q.id}=${sels[i].value}`).join('&');
      out.textContent = 'Putting it to the review panel…';
      const sol = await GT.answer(ans, C.answer);
      if (!sol) { out.textContent = 'The panel isn\'t convinced. At least one answer doesn\'t fit the evidence. The solution stays sealed.'; return; }
      dlg.close(); reveal(sol, true);
    } }, C.questions.map((q, i) => h('label', {}, h('span', {}, q.label), sels[i])), h('button', { type: 'submit', class: 'accuse' }, 'Submit accusation')),
    out,
    h('details', { class: 'giveup' }, h('summary', {}, 'Given up?'),
      h('p', {}, 'The case author can post a reveal key (on the thread where this case was shared) once the case closes.'),
      h('form', { class: 'req', onsubmit: async e => {
        e.preventDefault();
        const sol = await GT.answer(pass.value.trim(), C.reveal);
        if (!sol) { out.textContent = 'That reveal key doesn\'t open this case.'; return; }
        dlg.close(); reveal(sol, false);
      } }, pass, h('button', { type: 'submit' }, 'Unseal'))),
  ]);
}
function reveal(sol, won) {
  modal(won ? 'Case closed. You got it.' : 'The solution', [h('div', { class: 'reveal', html: sol.html })], 'wide');
}

function modal(title, kids, size) {
  const d = h('dialog', { class: `modal ${size || ''}` }, h('header', {}, h('h2', {}, title), h('button', { class: 'x', 'aria-label': 'Close', onclick: () => d.close() }, '×')), h('div', { class: 'modal-body' }, kids));
  d.addEventListener('close', () => d.remove());
  document.body.append(d); d.showModal(); return d;
}

boot().catch(e => fail('Something went wrong loading this case. Reload the page to try again.'));
