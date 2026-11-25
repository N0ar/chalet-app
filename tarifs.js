/* Onglet Tarifs : prix net par nuit, par périodes. Le prix affiché sur une plateforme = net ÷ (1 − frais). */
(function () {
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const date = (s) => { const [y, m, j] = s.split('-').map(Number); return new Date(y, m - 1, j, 12); };
  const add = (s, n) => { const d = date(s); d.setDate(d.getDate() + n); return iso(d); };
  const fmt = (s, o) => new Intl.DateTimeFormat('fr-FR', o).format(date(s));
  const dayTxt = (s) => fmt(s, { weekday: 'short', day: 'numeric', month: 'short', year: date(s).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; };
  const eur = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n).replace(/[  ]/g, ' ') + ' €';
  const PLAT = [['booking', 'Booking'], ['airbnb', 'Airbnb'], ['abritel', 'Abritel']];
  const FRAIS = { booking: 16.4, airbnb: 18.6, abritel: 10 };

  let defBase = 230, view = 'list', month = null, picked = null;
  const get = () => {
    const t = window.Hub.data().tarifs || {};
    return { base: num(t.base) || defBase, min: Math.round(num(t.min)) || 2, frais: Object.assign({}, FRAIS, t.frais || {}), periodes: Array.isArray(t.periodes) ? t.periodes : [] };
  };
  const set = (fn) => window.Hub.change((d) => { const t = get(); fn(t); t.maj = new Date().toISOString(); d.tarifs = t; });

  // Période applicable à une nuit : si plusieurs se recouvrent, celle qui commence le plus tard l'emporte.
  const periodFor = (D, t) => (t || get()).periodes.filter((p) => p.du <= D && D <= p.au).sort((a, b) => b.du.localeCompare(a.du))[0] || null;
  const net = (D, t) => { t = t || get(); const p = periodFor(D, t); return p ? num(p.net) : t.base; };
  const shown = (n, f) => Math.round(n / (1 - num(f) / 100));
  const platTxt = (n, t) => PLAT.map(([k, name]) => name + ' ' + eur(shown(n, t.frais[k]))).join(' · ');
  function avg(arr, dep) {
    if (!arr || !dep || dep <= arr) return null;
    const t = get(); let s = 0, n = 0;
    for (let D = arr; D < dep && n < 400; D = add(D, 1)) { s += net(D, t); n++; }
    return Math.round((s / n) * 100) / 100;
  }
  // Règles de durée : nuits minimum (par période, sinon règle générale) et périodes louées du samedi au samedi.
  const DOW = (s) => date(s).getDay();
  const minTxt = (p) => [num(p.min) > 0 ? Math.round(num(p.min)) + ' nuits min.' : '', p.sam ? 'du samedi au samedi' : ''].filter(Boolean).join(', ');
  function rules(arr, dep) {
    if (!arr || !dep || dep <= arr) return [];
    const t = get(), seen = [], out = []; let n = 0;
    for (let D = arr; D < dep && n < 400; D = add(D, 1)) { n++; const p = periodFor(D, t); if (p && seen.indexOf(p) < 0) seen.push(p); }
    const strict = seen.filter((p) => num(p.min) > 0 || p.sam);
    strict.forEach((p) => {
      const nom = p.nom || 'cette période';
      if (num(p.min) > n) out.push(nom + ' : ' + Math.round(num(p.min)) + ' nuits minimum (séjour de ' + n + ' nuit' + (n > 1 ? 's' : '') + ').');
      if (p.sam && (DOW(arr) !== 6 || DOW(dep) !== 6)) out.push(nom + ' : location du samedi au samedi.');
    });
    if (!strict.length && n < t.min) out.push(t.min + ' nuits minimum en dehors des périodes à la semaine (séjour de ' + n + ' nuit' + (n > 1 ? 's' : '') + ').');
    if (out.length) out.push('Le contrat peut tout de même être créé si vous acceptez cette exception.');
    return out;
  }
  function nightText(D) { const t = get(), p = periodFor(D, t), n = net(D, t); return 'Nuit à ' + eur(n) + ' net' + (p && (p.nom || minTxt(p)) ? ' (' + [p.nom, minTxt(p)].filter(Boolean).join(', ') + ')' : '') + ' · ' + platTxt(n, t); }

  // ---------- fiche d'une période ----------
  let sheet = null;
  function edit(p) {
    const isNew = !p; p = p || { id: 'p' + Date.now(), nom: '', du: '', au: '', net: '', min: '', sam: false };
    if (sheet) sheet.remove();
    sheet = el('div', 'sheet on'); const box = el('div', 'in'); sheet.append(box);
    box.append(el('h3', null, isNew ? 'Nouvelle période' : 'Modifier la période'));
    const card = el('div', 'card'); card.style.marginTop = '12px';
    const field = (label, type, val, attrs) => { const f = el('div', 'f'), l = el('label', null, label), i = el('input'); i.type = type; i.value = val == null ? '' : val; Object.assign(i, attrs || {}); f.append(l, i); card.append(f); return i; };
    const nom = field('Nom', 'text', p.nom, { placeholder: 'Noël', id: 'pNom' });
    const du = field('Première nuit', 'date', p.du, { id: 'pDu' });
    const au = field('Dernière nuit', 'date', p.au, { id: 'pAu' });
    const pn = field('Prix net par nuit', 'text', p.net, { inputMode: 'decimal', id: 'pNet' });
    pn.parentNode.append(el('span', 'u', '€'));
    const pm = field('Nuits minimum', 'text', p.min || '', { inputMode: 'numeric', id: 'pMin', placeholder: String(get().min) });
    const ps = field('Du samedi au samedi', 'checkbox', '', { id: 'pSam', checked: !!p.sam });
    const err = el('div', 'err'); err.hidden = true;
    const ok = el('button', 'btn', 'Enregistrer'), del = el('button', 'btn dan', 'Supprimer cette période'), no = el('button', 'btn sec', 'Annuler');
    [ok, del, no].forEach((b) => { b.type = 'button'; }); ok.id = 'pOk'; del.id = 'pDel';
    const close = () => { sheet.remove(); sheet = null; render(); };
    ok.addEventListener('click', () => {
      const v = { id: p.id, nom: nom.value.trim(), du: du.value, au: au.value, net: num(pn.value) };
      if (Math.round(num(pm.value)) > 0) v.min = Math.round(num(pm.value)); if (ps.checked) v.sam = true;
      const m = !v.du || !v.au ? 'Indiquez la première et la dernière nuit.' : v.au < v.du ? 'La dernière nuit doit être après la première.' : v.net <= 0 ? 'Indiquez le prix net par nuit.' : '';
      if (m) { err.textContent = m; err.hidden = false; return; }
      set((t) => { const i = t.periodes.findIndex((x) => x.id === v.id); if (i >= 0) t.periodes[i] = v; else t.periodes.push(v); });
      close();
    });
    del.addEventListener('click', () => { if (!window.confirm('Supprimer cette période ?')) return; set((t) => { t.periodes = t.periodes.filter((x) => x.id !== p.id); }); close(); });
    no.addEventListener('click', close);
    box.append(card, err, ok, no); if (!isNew) box.append(del);
    document.body.append(sheet);
  }

  // ---------- affichage ----------
  function render() {
    const root = document.getElementById('tar'); if (!root) return; root.textContent = '';
    const t = get(), today = iso(new Date());
    const st = el('div', 'cal-status'); st.append(el('span', null, window.Hub.status()));
    const sb = el('button', null, 'Synchroniser'); sb.type = 'button'; sb.disabled = window.Hub.busy || !window.Hub.ready; sb.addEventListener('click', () => window.Hub.sync()); st.append(sb); root.append(st);
    const seg = el('div', 'seg');
    [['list', 'Liste'], ['month', 'Mois']].forEach(([k, n]) => { const b = el('button', view === k ? 'on' : null, n); b.type = 'button'; b.dataset.view = k; b.addEventListener('click', () => { view = k; render(); }); seg.append(b); });
    root.append(seg);
    if (view === 'month') return renderMonth(root, t, today);

    root.append(el('h2', null, 'Prix de base'));
    const c1 = el('div', 'card'), f1 = el('div', 'f'), l1 = el('label', null, 'Prix net par nuit'); l1.append(el('small', null, 'hors périodes'));
    const i1 = el('input'); i1.inputMode = 'decimal'; i1.id = 'tBase'; i1.value = String(t.base).replace('.', ',');
    i1.addEventListener('change', () => { const v = num(i1.value); if (v === get().base) return; if (v > 0) set((x) => { x.base = v; }); else render(); });
    f1.append(l1, i1, el('span', 'u', '€')); c1.append(f1);
    const f0 = el('div', 'f'), l0 = el('label', null, 'Nuits minimum'); l0.append(el('small', null, 'hors périodes, sous réserve de votre accord'));
    const i0 = el('input'); i0.inputMode = 'numeric'; i0.id = 'tMin'; i0.value = String(t.min);
    i0.addEventListener('change', () => { const v = Math.round(num(i0.value)); if (v === get().min) return; if (v > 0) set((x) => { x.min = v; }); else render(); });
    f0.append(l0, i0, el('span', 'u', 'nuits')); c1.append(f0); root.append(c1, el('p', 'note', platTxt(t.base, t)));

    root.append(el('h2', null, 'Périodes'));
    const ps = t.periodes.slice().sort((a, b) => a.du.localeCompare(b.du));
    if (!ps.length) root.append(el('div', 'cal-free', 'Aucune période : le prix de base s’applique toute l’année.'));
    ps.forEach((p) => {
      const a = el('div', 'stay tap' + (p.au < today ? ' old' : '')); a.style.borderLeftColor = 'var(--wood)';
      const box = el('div', 'n'), n = Math.round((date(p.au) - date(p.du)) / 864e5) + 1;
      box.append(el('b', null, p.nom || 'Période sans nom'), el('span', null, cap(dayTxt(p.du)) + ' → ' + dayTxt(p.au) + ' · ' + n + ' nuit' + (n > 1 ? 's' : '')), el('span', null, platTxt(num(p.net), t)));
      if (minTxt(p)) box.append(el('span', null, cap(minTxt(p))));
      if (p.sam && (DOW(p.du) !== 6 || DOW(add(p.au, 1)) !== 6)) box.append(el('span', 'turn', 'Ne va pas d’un samedi au samedi'));
      const over = ps.filter((o) => o !== p && o.du <= p.au && p.du <= o.au && o.du >= p.du);
      if (over.length) box.append(el('span', 'turn', 'Sauf les nuits de : ' + over.map((o) => o.nom || 'période sans nom').join(', ')));
      a.append(box, el('em', null, eur(num(p.net)))); a.addEventListener('click', () => edit(p)); root.append(a);
    });
    const nb = el('button', 'btn', 'Ajouter une période'); nb.type = 'button'; nb.id = 'pNew'; nb.addEventListener('click', () => edit(null)); root.append(nb);

    root.append(el('h2', null, 'Frais des plateformes'));
    const c2 = el('div', 'card');
    PLAT.forEach(([k, name]) => {
      const f = el('div', 'f'), i = el('input'); i.inputMode = 'decimal'; i.dataset.frais = k; i.value = String(t.frais[k]).replace('.', ',');
      i.addEventListener('change', () => { const v = num(i.value); if (v === get().frais[k]) return; if (v >= 0 && v < 90) set((x) => { x.frais[k] = v; }); else render(); });
      f.append(el('label', null, name), i, el('span', 'u', '%')); c2.append(f);
    });
    root.append(c2, el('p', 'note', 'Prix affiché sur une plateforme = prix net ÷ (1 − frais). Sur le site et leboncoin, le prix affiché est le prix net. Le taux Abritel est à vérifier.'));
    const sh = el('button', 'btn sec', 'Envoyer la grille de tarifs'); sh.type = 'button';
    sh.addEventListener('click', () => {
      const txt = ['Tarifs du chalet (prix net par nuit)', 'Prix de base : ' + eur(t.base) + ' · ' + platTxt(t.base, t)]
        .concat(ps.filter((p) => p.au >= today).map((p) => (p.nom || 'Période') + ', du ' + dayTxt(p.du) + ' au ' + dayTxt(p.au) + ' inclus : ' + eur(num(p.net)) + ' · ' + platTxt(num(p.net), t))).join('\n');
      if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
    });
    root.append(sh);
  }

  function renderMonth(root, t, today) {
    if (!month) { const n = new Date(); month = new Date(n.getFullYear(), n.getMonth(), 1, 12); }
    const head = el('div', 'cal-head'), pv = el('button', null, '‹'), nx = el('button', null, '›'); pv.type = nx.type = 'button';
    pv.setAttribute('aria-label', 'Mois précédent'); nx.setAttribute('aria-label', 'Mois suivant');
    const go = (n) => { month = new Date(month.getFullYear(), month.getMonth() + n, 1, 12); picked = null; render(); };
    pv.addEventListener('click', () => go(-1)); nx.addEventListener('click', () => go(1));
    head.append(pv, el('b', null, cap(new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(month))), nx);
    const grid = el('div', 'cal-grid price');
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((d) => grid.append(el('div', 'dow', d)));
    const first = (month.getDay() + 6) % 7, days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let i = 0; i < first; i++) grid.append(el('div', 'day off'));
    for (let j = 1; j <= days; j++) {
      const D = iso(new Date(month.getFullYear(), month.getMonth(), j, 12)), p = periodFor(D, t);
      const c = el('button', 'day' + (D < today ? ' past' : '') + (D === today ? ' today' : '') + (D === picked ? ' sel' : '') + (p ? ' per' : '')); c.type = 'button';
      c.append(el('span', null, String(j)), el('small', null, String(Math.round(net(D, t)))));
      c.addEventListener('click', () => { picked = picked === D ? null : D; render(); });
      grid.append(c);
    }
    const card = el('div', 'cal-card'); card.append(head, grid); root.append(card);
    root.append(el('p', 'note', 'Prix net de la nuit qui commence ce jour-là, en euros. Les jours colorés appartiennent à une période.'));
    if (picked) {
      const p = periodFor(picked, t), n = net(picked, t);
      root.append(el('h2', null, cap(fmt(picked, { weekday: 'long', day: 'numeric', month: 'long' }))));
      const a = el('div', 'stay' + (p ? ' tap' : '')); a.style.borderLeftColor = p ? 'var(--wood)' : 'var(--line)';
      const box = el('div', 'n'); box.append(el('b', null, p ? p.nom || 'Période sans nom' : 'Prix de base'), el('span', null, platTxt(n, t)));
      a.append(box, el('em', null, eur(n))); if (p) a.addEventListener('click', () => edit(p)); root.append(a);
    }
  }

  // Réaffichage différé : un champ qui valide sa saisie au moment où l'on touche un bouton ne doit pas faire perdre ce toucher.
  let later = null;
  window.Hub.on(() => {
    const v = document.getElementById('v-tar'); if (!v || !v.classList.contains('on') || sheet) return;
    const s = document.querySelector('#tar .cal-status span'); if (s) s.textContent = window.Hub.status();
    clearTimeout(later);
    later = setTimeout(() => { const f = document.activeElement; if (v.classList.contains('on') && !sheet && !(f && f.tagName === 'INPUT' && v.contains(f))) render(); }, 350);
  });
  window.Tarifs = { open(base) { defBase = num(base) || defBase; render(); }, avg, nightText, rules };
})();
