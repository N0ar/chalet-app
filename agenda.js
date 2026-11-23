/* Onglet Agenda : lecture seule du hub de calendriers. Le jeton reste sur l'appareil (localStorage), jamais dans le code. */
(function () {
  const SRC = {
    booking: { n: 'Booking', c: '#2563a8', t: '#cfe0f5' },
    airbnb: { n: 'Airbnb', c: '#d9434a', t: '#f9d3d5' },
    abritel: { n: 'Abritel', c: '#b97a06', t: '#f6e2b5' },
    google: { n: 'Direct ou blocage', c: '#3f8f5a', t: '#cfe8d6' }
  };
  const OTHER = { n: 'Autre', c: '#5d6f75', t: '#dde3e5' };
  const src = (id) => SRC[id] || OTHER;
  const TOKEN_KEY = 'chalet.token', CACHE_KEY = 'chalet.agenda';
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const date = (s) => { const [y, m, j] = s.split('-').map(Number); return new Date(y, m - 1, j, 12); };
  const nights = (e) => Math.round((date(e.end) - date(e.start)) / 864e5);
  const fmt = (s, o) => new Intl.DateTimeFormat('fr-FR', o).format(date(s));
  const dayTxt = (s) => fmt(s, { weekday: 'short', day: 'numeric', month: 'short' });
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const token = {
    get() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return token.mem || ''; } },
    set(v) { token.mem = v; try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* stockage indisponible */ } }
  };
  const cache = {
    get() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
  };

  let data = null, month = null, picked = null, busy = false, error = '', hub = '', goSettings = () => {};

  // Accepte l'adresse du hub seule ou une adresse de flux complète collée par erreur.
  const base = (u) => String(u || '').trim().replace(/\/feed\/.*$/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');

  async function load(force) {
    const b = base(hub), t = token.get();
    if (!b || !t) { error = 'config'; render(); return; }
    busy = true; error = ''; render();
    try {
      const r = await fetch(b + '/feed/all.json?key=' + encodeURIComponent(t), { cache: force ? 'reload' : 'default' });
      if (r.status === 403) throw new Error('Le jeton a été refusé par le hub. Vérifiez-le dans les Réglages.');
      if (r.status === 503) { let s = ''; try { s = (await r.json()).source || ''; } catch (e) { /* corps illisible */ } throw new Error('Le calendrier ' + (s ? src(s).n + ' ' : '') + 'est momentanément indisponible. Réessayez dans quelques minutes.'); }
      if (!r.ok) throw new Error('Le hub a répondu avec une erreur (' + r.status + ').');
      const j = await r.json();
      if (!j || !Array.isArray(j.events)) throw new Error('La réponse du hub n’a pas le format attendu.');
      data = { events: j.events.filter((e) => e && /^\d{4}-\d\d-\d\d$/.test(e.start) && /^\d{4}-\d\d-\d\d$/.test(e.end) && e.end > e.start),
        sources: Array.isArray(j.sources) ? j.sources : [], conflicts: Array.isArray(j.conflicts) ? j.conflicts : [], at: Date.now() };
      cache.set(data);
    } catch (e) {
      error = e instanceof TypeError ? 'Pas de connexion au hub. ' + (data ? 'Les dernières données connues sont affichées.' : 'Vérifiez la connexion Internet et l’adresse du hub.') : e.message;
    }
    busy = false; render();
  }

  function open(hubUrl, onSettings) {
    hub = hubUrl; goSettings = onSettings || goSettings;
    if (!data) data = cache.get();
    if (!month) { const n = new Date(); month = new Date(n.getFullYear(), n.getMonth(), 1, 12); }
    render();
    if (!data || Date.now() - data.at > 5 * 60 * 1000) load(false);
  }

  function ago(ms) {
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return 'à l’instant'; if (m < 60) return 'il y a ' + m + ' min';
    const h = Math.round(m / 60); if (h < 24) return 'il y a ' + h + ' h';
    return 'il y a ' + Math.round(h / 24) + ' j';
  }

  function render() {
    const root = document.getElementById('cal'); if (!root) return; root.textContent = '';
    if (error === 'config') {
      const d = el('div', 'empty'); d.append('Pour afficher l’agenda, indiquez l’adresse du hub et le jeton d’accès dans les Réglages.');
      const b = el('button', 'btn', 'Ouvrir les Réglages'); b.type = 'button'; b.addEventListener('click', () => goSettings()); root.append(d, b); return;
    }
    const today = iso(new Date()), ev = data ? data.events : [];

    // État et avertissements
    const st = el('div', 'cal-status');
    st.append(el('span', null, busy ? 'Chargement…' : data ? 'Mis à jour ' + ago(data.at) : 'Aucune donnée'));
    const rb = el('button', null, 'Actualiser'); rb.type = 'button'; rb.disabled = busy; rb.addEventListener('click', () => load(true)); st.append(rb); root.append(st);
    if (error) root.append(el('div', 'err', error));
    if (data) {
      data.sources.filter((s) => s && s.ok === false).forEach((s) => root.append(el('div', 'warn', src(s.id).n + ' n’a pas pu être synchronisé : ses réservations récentes peuvent manquer.')));
      data.conflicts.filter((c) => c && c.to >= today).forEach((c) => root.append(el('div', 'err', 'Chevauchement entre ' + (c.sources || []).map((s) => src(s).n).join(' et ') + ' du ' + dayTxt(c.from) + ' au ' + dayTxt(c.to))));
    }

    // Mois
    const head = el('div', 'cal-head');
    const pv = el('button', null, '‹'), nx = el('button', null, '›'); pv.type = nx.type = 'button'; pv.setAttribute('aria-label', 'Mois précédent'); nx.setAttribute('aria-label', 'Mois suivant');
    const go = (n) => { month = new Date(month.getFullYear(), month.getMonth() + n, 1, 12); picked = null; render(); };
    pv.addEventListener('click', () => go(-1)); nx.addEventListener('click', () => go(1));
    const title = el('b', null, cap(new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(month)));
    title.addEventListener('click', () => { const n = new Date(); month = new Date(n.getFullYear(), n.getMonth(), 1, 12); picked = null; render(); });
    head.append(pv, title, nx);
    const grid = el('div', 'cal-grid');
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((d) => grid.append(el('div', 'dow', d)));
    const first = (month.getDay() + 6) % 7, days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let i = 0; i < first; i++) grid.append(el('div', 'day off'));
    for (let j = 1; j <= days; j++) {
      const D = iso(new Date(month.getFullYear(), month.getMonth(), j, 12));
      const L = ev.filter((e) => e.start < D && D <= e.end), R = ev.filter((e) => e.start <= D && D < e.end);
      const c = el('button', 'day' + (D < today ? ' past' : '') + (D === today ? ' today' : '') + (D === picked ? ' sel' : '')); c.type = 'button';
      const l = L.length ? src(L[0].source).t : 'transparent', r = R.length ? src(R[0].source).t : 'transparent';
      if (L.length || R.length) c.style.background = 'linear-gradient(90deg,' + l + ' 0 50%,' + r + ' 50% 100%)';
      c.append(el('span', null, String(j)));
      if (L.length > 1 || R.length > 1) c.append(el('i', 'dot'));
      c.addEventListener('click', () => { picked = picked === D ? null : D; render(); });
      grid.append(c);
    }
    let x0 = null;
    grid.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    grid.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); }, { passive: true });
    const card = el('div', 'cal-card'); card.append(head, grid);
    const lg = el('div', 'legend');
    Object.keys(SRC).forEach((k) => { const s = el('span'); const sw = el('i'); sw.style.background = SRC[k].t; sw.style.borderColor = SRC[k].c; s.append(sw, SRC[k].n); lg.append(s); });
    card.append(lg); root.append(card);

    const row = (e, badge) => {
      const s = src(e.source), a = el('div', 'stay'); a.style.borderLeftColor = s.c;
      const n = nights(e), box = el('div', 'n');
      box.append(el('b', null, cap(dayTxt(e.start)) + ' → ' + dayTxt(e.end)), el('span', null, n + ' nuit' + (n > 1 ? 's' : '') + ' · ' + s.n));
      if (ev.some((o) => o !== e && o.start === e.end)) box.append(el('span', 'turn', 'Nouvelle arrivée le jour du départ'));
      a.append(box); if (badge) a.append(el('em', null, badge)); return a;
    };

    // Détail du jour touché
    if (picked) {
      root.append(el('h2', null, cap(fmt(picked, { weekday: 'long', day: 'numeric', month: 'long' }))));
      const hit = ev.filter((e) => e.start <= picked && picked <= e.end);
      if (!hit.length) root.append(el('div', 'cal-free', 'Chalet libre ce jour-là.'));
      hit.forEach((e) => root.append(row(e, e.start === picked ? 'Arrivée' : e.end === picked ? 'Départ' : 'Occupé')));
    }

    // Prochaines arrivées et départs
    root.append(el('h2', null, 'Prochains séjours'));
    const next = ev.filter((e) => e.end >= today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 15);
    if (!next.length) root.append(el('div', 'cal-free', data ? 'Aucun séjour à venir.' : 'Les séjours s’afficheront après le premier chargement.'));
    next.forEach((e) => {
      const d = Math.round((date(e.start) - date(today)) / 864e5);
      const badge = e.end === today ? 'Départ aujourd’hui' : e.start === today ? 'Arrivée aujourd’hui' : d < 0 ? 'En cours' : d === 1 ? 'Demain' : 'Dans ' + d + ' j';
      root.append(row(e, badge));
    });
  }

  window.Agenda = { open, token, reset() { data = null; error = ''; cache.set(null); } };
})();
