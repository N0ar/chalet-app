/* Le Chalet Sciez — application de contrats. Tout est stocké sur l'appareil (localStorage). */
(function () {
  const VERSION = '1.4';
  const $ = (q) => document.querySelector(q), $$ = (q) => Array.from(document.querySelectorAll(q));
  const { compute, check, build, fileName, eur, dmy, num } = window.Contrat;

  // ---------- stockage ----------
  const DEF = {
    bailleur: { nom: '', adresse1: '', adresse2: '', tel: '', email1: '', email2: '', initiales: '' }, signature: '',
    prixNuit: 230, basePers: 6, suppPers: 10, capacite: 8, menage: 100, arrhesPct: 30, depot: 1500,
    heureArrivee: '15 h', heureDepart: '11 h', annulJours: 21, delaiRetour: 7, tabac: 150, kwh: 0.2, site: 'www.lechaletsciez.fr', hubUrl: ''
  };
  const mem = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return k in mem ? mem[k] : d; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible : on garde en mémoire */ } }
  };
  const merge = (a, b) => { const o = Object.assign({}, a, b || {}); o.bailleur = Object.assign({}, a.bailleur, (b || {}).bailleur || {}); return o; };
  let S = merge(DEF, store.get('chalet.settings', {}));
  let contracts = store.get('chalet.contracts', []);
  let cur = null, blob = null, back = 'list', autoPrix = false;

  // Points de suivi d'un séjour direct. La valeur enregistrée est la date à laquelle le point a été coché.
  const STEPS = [['envoye', 'Contrat envoyé'], ['signe', 'Contrat signé reçu'], ['arrhes', 'Arrhes reçues'], ['assurance', 'Attestation d’assurance reçue'],
    ['solde', 'Solde reçu'], ['depot', 'Dépôt de garantie reçu'], ['edlEntree', 'État des lieux d’entrée'], ['edlSortie', 'État des lieux de sortie'], ['depotRendu', 'Dépôt restitué']];
  const prog = (c) => STEPS.filter((s) => (c.suivi || {})[s[0]]).length;
  const progTxt = (c) => (prog(c) === STEPS.length ? 'Suivi complet' : 'Suivi ' + prog(c) + '/' + STEPS.length);

  const today = () => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  const blank = () => ({ id: 'c' + Date.now(), etabliLe: today(), arrivee: '', depart: '', personnes: '', bebes: 0, animaux: 0, suppAnimaux: 0,
    prixNuit: S.prixNuit, basePers: S.basePers, suppPers: S.suppPers, menage: S.menage, remiseMontant: '', remiseLibelle: '', arrhesPct: S.arrhesPct, depot: S.depot, suivi: {},
    loc: { nom: '', adresse: '', cpVille: '', pays: 'France', tel: '', email: '' } });
  const getP = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const setP = (o, p, v) => { const ks = p.split('.'); const l = ks.pop(); ks.reduce((x, k) => x[k], o)[l] = v; };
  const toast = (t) => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2200); };

  // ---------- navigation ----------
  function show(tab) {
    $$('.view').forEach((v) => v.classList.toggle('on', v.id === 'v-' + tab));
    $$('nav.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === (tab === 'form' ? 'list' : tab)));
    if (tab !== 'set') back = tab;
    $('#topBtn').hidden = tab !== 'set'; $('#setBtn').hidden = tab === 'set';
    $('#title').textContent = tab === 'list' ? 'Contrats' : tab === 'set' ? 'Réglages' : tab === 'cal' ? 'Agenda' : tab === 'tar' ? 'Tarifs' : (contracts.some((c) => c.id === cur.id) ? 'Modifier le contrat' : 'Nouveau contrat');
    window.scrollTo(0, 0);
    if (tab === 'list') renderList();
    if (tab === 'set') renderSettings();
    if (tab === 'cal') window.Agenda.open(S.hubUrl, () => show('set'), stayLink, (D) => window.Tarifs.nightText(D));
    if (tab === 'tar') window.Tarifs.open(S.prixNuit);
  }
  // Depuis l'agenda : un séjour direct ouvre son contrat (mêmes dates), ou en propose la création.
  function stayLink(e) {
    if (e.source !== 'google') return null;
    const c = contracts.find((x) => x.arrivee === e.start && x.depart === e.end);
    if (c) return { txt: 'Contrat : ' + (c.loc.nom || 'sans nom') + ' · ' + progTxt(c).toLowerCase(), go: () => openForm(JSON.parse(JSON.stringify(c))) };
    const sh = window.Hub.data().suivi[e.start + '_' + e.end];
    if (sh) return { txt: progTxt({ suivi: sh.pts }) + ' · créer le contrat sur cet appareil', go: () => openForm(Object.assign(blank(), { arrivee: e.start, depart: e.end, suivi: Object.assign({}, sh.pts) })) };
    return { txt: 'Créer le contrat', go: () => openForm(Object.assign(blank(), { arrivee: e.start, depart: e.end })) };
  }
  $$('nav.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  $('#setBtn').addEventListener('click', () => show('set'));
  $('#topBtn').addEventListener('click', () => show(back));
  $('#newBtn').addEventListener('click', () => openForm(blank()));

  // ---------- liste ----------
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function renderList() {
    const el = $('#list'); el.textContent = '';
    if (!contracts.length) {
      const d = document.createElement('div'); d.className = 'empty';
      const i = document.createElement('img'); i.src = window.ASSETS.logo; i.alt = '';
      d.append(i, 'Aucun contrat pour le moment.', document.createElement('br'), 'Créez le premier avec le bouton ci-dessous.'); el.append(d); return;
    }
    contracts.slice().sort((a, b) => (b.arrivee || '').localeCompare(a.arrivee || '')).forEach((c) => {
      const k = compute(c), a = document.createElement('a'); a.href = '#';
      const [y, m, j] = (c.arrivee || '--').split('-');
      const d = document.createElement('div'); d.className = 'd'; d.append(String(Number(j) || '–'));
      const sm = document.createElement('small'); sm.textContent = MOIS[Number(m) - 1] || ''; d.append(sm);
      const n = document.createElement('div'); n.className = 'n';
      const b = document.createElement('b'); b.textContent = c.loc.nom || 'Sans nom';
      const sp = document.createElement('span'); sp.textContent = (y || '') + ' · ' + k.nuits + ' nuit' + (k.nuits > 1 ? 's' : '') + ' · ' + k.pers + ' pers.';
      n.append(b, sp);
      const p = document.createElement('div'); p.className = 'p'; p.textContent = eur(k.total);
      const pg = document.createElement('small'); pg.textContent = progTxt(c); if (prog(c) === STEPS.length) pg.className = 'ok'; p.append(pg);
      a.append(d, n, p); a.addEventListener('click', (e) => { e.preventDefault(); openForm(JSON.parse(JSON.stringify(c))); }); el.append(a);
    });
  }

  // ---------- formulaire ----------
  function openForm(c) {
    cur = c; blob = null; autoPrix = !contracts.some((x) => x.id === c.id);
    $$('#form [data-k]').forEach((i) => { const v = getP(cur, i.dataset.k); i.value = v == null ? '' : v; });
    $('#delBtn').hidden = !contracts.some((x) => x.id === cur.id);
    $('#err').hidden = true;
    applyPrix(); refresh(); renderSuivi(); show('form');
  }
  // Le suivi est partagé via le hub sous la seule clé des dates du séjour : ni nom ni coordonnées.
  const skey = (c) => (c.arrivee && c.depart ? c.arrivee + '_' + c.depart : '');
  function shareSuivi(c) { const k = skey(c); if (k) window.Hub.change((d) => { d.suivi[k] = { pts: Object.assign({}, c.suivi), maj: new Date().toISOString() }; }); }
  function reconcile() {
    const sh = window.Hub.data().suivi, up = []; let ch = false;
    contracts.forEach((c) => {
      const k = skey(c), r = k && sh[k]; if (!k) return;
      if (r) { if (JSON.stringify(r.pts || {}) !== JSON.stringify(c.suivi || {})) { c.suivi = Object.assign({}, r.pts); ch = true; } }
      else if (c.suivi && Object.keys(c.suivi).length) up.push(c);
    });
    if (ch) store.set('chalet.contracts', contracts);
    if (up.length) window.Hub.change((d) => up.forEach((c) => { d.suivi[skey(c)] = { pts: Object.assign({}, c.suivi), maj: new Date().toISOString() }; }));
    return ch;
  }
  // ---------- contrats partagés, chiffrés avec la phrase secrète ----------
  let cBusy = false, cAgain = false, cState = 'local';
  const stamp = () => new Date().toISOString();
  function noteC() {
    $('#cNote').textContent = cState === 'ok' ? 'Contrats partagés via le hub, chiffrés avec votre phrase secrète.'
      : cState === 'bad' ? 'Des contrats du hub ne peuvent pas être lus : la phrase secrète n’est pas la même sur tous les appareils. Corrigez-la dans les Réglages.'
      : 'Contrats enregistrés sur cet appareil seulement. Pour les partager, indiquez une phrase secrète dans les Réglages.';
    $('#cNote').style.color = cState === 'bad' ? 'var(--bad)' : '';
  }
  async function syncContracts() {
    if (!window.Coffre.ready()) { cState = 'local'; noteC(); return; }
    if (cBusy) { cAgain = true; return; }
    cBusy = true; let changed = false; const up = {};
    try {
      const items = window.Hub.data().contrats.items;
      for (const id of Object.keys(items)) { // du hub vers l'appareil : la version la plus récente l'emporte
        const it = items[id], i = contracts.findIndex((x) => x.id === id), loc = i >= 0 ? contracts[i] : null;
        if (!it || (loc && (loc.maj || '') >= String(it.maj || ''))) continue;
        if (it.del) { if (loc) { contracts.splice(i, 1); changed = true; } continue; }
        const c = await window.Coffre.dec(it); if (!c || !c.loc) continue;
        c.id = id; c.maj = it.maj; c.suivi = loc ? loc.suivi : {};
        if (loc) contracts[i] = c; else contracts.push(c); changed = true;
      }
      for (const c of contracts) { // de l'appareil vers le hub
        const it = items[c.id]; if (it && String(it.maj || '') >= (c.maj || '')) continue;
        if (!c.maj) { c.maj = stamp(); changed = true; }
        const plain = Object.assign({}, c); delete plain.suivi;
        up[c.id] = Object.assign({ maj: c.maj }, await window.Coffre.enc(plain));
      }
      cState = 'ok';
    } catch (e) { cState = 'bad'; }
    if (changed) { store.set('chalet.contracts', contracts); reconcile(); }
    cBusy = false; noteC();
    if (cState === 'ok' && Object.keys(up).length) window.Hub.change((d) => Object.assign(d.contrats.items, up));
    if (changed && $('#v-list').classList.contains('on')) renderList();
    if (cAgain) { cAgain = false; syncContracts(); }
  }
  // Prix par nuit proposé d'après la grille de tarifs (moyenne des nuits du séjour), tant qu'il n'a pas été saisi à la main.
  function applyPrix() {
    if (!autoPrix) return; const v = window.Tarifs.avg(cur.arrivee, cur.depart); if (v == null) return;
    cur.prixNuit = v; $('#prixNuit').value = String(v).replace('.', ',');
  }
  function renderSuivi() {
    const saved = contracts.find((x) => x.id === cur.id), box = $('#suivi');
    $('#suiviBox').hidden = !saved; box.textContent = ''; if (!saved) return;
    cur.suivi = cur.suivi || {};
    $('#suiviPct').textContent = prog(cur) + '/' + STEPS.length;
    STEPS.forEach(([k, txt]) => {
      const l = document.createElement('label'); l.className = 'chk' + (cur.suivi[k] ? ' done' : '');
      const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!cur.suivi[k];
      const s = document.createElement('span'); s.textContent = txt; l.append(i, s);
      if (cur.suivi[k]) { const d = document.createElement('small'); d.textContent = dmy(cur.suivi[k]); l.append(d); }
      i.addEventListener('change', () => {
        if (i.checked) cur.suivi[k] = today(); else delete cur.suivi[k];
        // Le suivi s'enregistre tout de suite, sans toucher aux autres champs du contrat enregistré.
        const st = contracts.find((x) => x.id === cur.id); if (st) { st.suivi = Object.assign({}, cur.suivi); store.set('chalet.contracts', contracts); shareSuivi(st); }
        renderSuivi();
      });
      box.append(l);
    });
  }
  function refresh() {
    const k = compute(cur);
    $('#baseLbl').textContent = 'jusqu’à ' + k.base + ' personnes';
    $('#rowAnimaux').style.display = k.animaux > 0 ? '' : 'none';
    const rows = [[k.nuits + ' nuit' + (k.nuits > 1 ? 's' : '') + ' × ' + eur(num(cur.prixNuit)), eur(k.heb)]];
    if (k.extra > 0) rows.push([k.extra + ' pers. en plus', eur(k.supp)]);
    if (k.suppAnimaux > 0) rows.push(['Animaux', eur(k.suppAnimaux)]);
    rows.push(['Ménage et linge', eur(k.menage)]);
    if (k.remise > 0) rows.push(['Remise', '− ' + eur(k.remise)]);
    const el = $('#sum'); el.textContent = '';
    const add = (a, b, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; const x = document.createElement('span'); x.textContent = a; const y = document.createElement('span'); y.textContent = b; d.append(x, y); el.append(d); };
    rows.forEach((r) => add(r[0], r[1]));
    add('Total du séjour', eur(k.total), 'tot');
    add('Arrhes (' + num(cur.arrhesPct) + ' %)', eur(k.arrhes), 'pay');
    add('Solde à l’arrivée', eur(k.solde), 'pay');
  }
  $('#form').addEventListener('input', (e) => {
    const i = e.target; if (!i.dataset.k) return;
    setP(cur, i.dataset.k, i.value);
    if (i.dataset.k === 'prixNuit') autoPrix = false;
    $('#err').hidden = true;
    // Proposer un départ 7 nuits après l'arrivée tant que le départ est vide.
    if (i.dataset.k === 'arrivee' && i.value && !cur.depart) { const [y, m, j] = i.value.split('-').map(Number); const t = new Date(y, m - 1, j + 7, 12); cur.depart = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); $('#depart').value = cur.depart; }
    if (i.dataset.k === 'arrivee' || i.dataset.k === 'depart') applyPrix();
    refresh();
  });
  function save() {
    const i = contracts.findIndex((x) => x.id === cur.id);
    cur.maj = stamp();
    const copy = JSON.parse(JSON.stringify(cur));
    if (i >= 0) contracts[i] = copy; else contracts.push(copy);
    store.set('chalet.contracts', contracts); $('#delBtn').hidden = false; if (copy.suivi && Object.keys(copy.suivi).length) shareSuivi(copy); renderSuivi(); syncContracts();
  }
  $('#genBtn').addEventListener('click', () => {
    const errs = check(cur, S), box = $('#err');
    box.textContent = ''; box.hidden = !errs.length;
    if (errs.length) { errs.forEach((t) => { const p = document.createElement('p'); p.textContent = t; box.append(p); }); box.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    const btn = $('#genBtn'); btn.disabled = true; btn.textContent = 'Création en cours…';
    save();
    const done = () => { btn.disabled = false; btn.textContent = 'Créer le contrat PDF'; };
    try {
      window.pdfMake.createPdf(build(cur, S, window.ASSETS)).getBlob((b) => {
        blob = b; done(); $('#sheetName').textContent = fileName(cur); $('#sheet').classList.add('on');
      });
    } catch (e) { done(); box.hidden = false; box.textContent = 'Le PDF n’a pas pu être créé : ' + e.message; }
  });
  $('#delBtn').addEventListener('click', () => {
    if (!window.confirm('Supprimer définitivement ce contrat de l’appareil ?')) return;
    const gone = cur.id; contracts = contracts.filter((x) => x.id !== gone); store.set('chalet.contracts', contracts);
    if (window.Hub.data().contrats.items[gone] || window.Coffre.ready()) window.Hub.change((d) => { d.contrats.items[gone] = { maj: stamp(), del: true }; }); toast('Contrat supprimé'); show('list');
  });

  // ---------- partage du PDF ----------
  function download(b, name) {
    const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  }
  $('#shareBtn').addEventListener('click', async () => {
    const name = fileName(cur), file = new File([blob], name, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Contrat de location — Le Chalet Sciez' }); } catch (e) { if (e.name !== 'AbortError') download(blob, name); }
    } else download(blob, name);
  });
  $('#openBtn').addEventListener('click', () => { const u = URL.createObjectURL(blob); if (!window.open(u, '_blank')) location.href = u; });
  $('#closeBtn').addEventListener('click', () => { $('#sheet').classList.remove('on'); show('list'); });

  // ---------- réglages ----------
  function renderSettings() {
    $$('#v-set [data-s]').forEach((i) => { const v = getP(S, i.dataset.s); i.value = v == null ? '' : String(v).replace('.', i.inputMode === 'decimal' ? ',' : '.'); });
    $('#tok').value = window.Agenda.token.get(); $('#pass').value = window.Coffre.pass.get();
    const has = !!S.signature; $('#sigImg').hidden = !has; if (has) $('#sigImg').src = S.signature;
    $('#sigTxt').textContent = has ? 'Signature enregistrée' : 'Aucune signature';
    $('#ver').textContent = 'Version ' + VERSION + ' · ' + contracts.length + ' contrat' + (contracts.length > 1 ? 's' : '') + ' sur cet appareil';
  }
  $('#v-set').addEventListener('input', (e) => { const i = e.target; if (!i.dataset.s) return; setP(S, i.dataset.s, i.value); store.set('chalet.settings', S); if (i.dataset.s === 'hubUrl') { window.Agenda.reset(); window.Hub.init(S.hubUrl); } });
  $('#tok').addEventListener('input', (e) => { window.Agenda.token.set(e.target.value.trim()); window.Agenda.reset(); });
  $('#pass').addEventListener('input', (e) => window.Coffre.pass.set(e.target.value));
  $('#topBtn').addEventListener('click', () => { if (window.Hub.ready) window.Hub.sync(); else syncContracts(); });
  $('#sigBtn').addEventListener('click', () => $('#sigFile').click());
  $('#sigFile').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image(), u = URL.createObjectURL(f);
    img.onload = () => { // réduire l'image pour qu'elle tienne dans le stockage de l'appareil
      const r = Math.min(1, 700 / img.width), cv = document.createElement('canvas'); cv.width = Math.round(img.width * r); cv.height = Math.round(img.height * r);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); S.signature = cv.toDataURL('image/png'); store.set('chalet.settings', S); URL.revokeObjectURL(u); renderSettings(); toast('Signature enregistrée');
    };
    img.src = u; e.target.value = '';
  });
  $('#expBtn').addEventListener('click', () => {
    const b = new Blob([JSON.stringify({ type: 'chalet-sauvegarde', date: today(), settings: S, contracts }, null, 1)], { type: 'application/json' });
    const name = 'chalet-sauvegarde-' + today() + '.json', file = new File([b], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file] }).catch(() => {}); else download(b, name);
  });
  $('#impBtn').addEventListener('click', () => $('#impFile').click());
  $('#impFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!j || typeof j !== 'object' || !j.settings) throw new Error('format');
      S = merge(merge(DEF, S), j.settings); store.set('chalet.settings', S);
      let n = 0;
      if (Array.isArray(j.contracts)) j.contracts.forEach((c) => { if (c && c.id && c.loc && !contracts.some((x) => x.id === c.id)) { contracts.push(c); n++; } });
      store.set('chalet.contracts', contracts); renderSettings(); window.Hub.init(S.hubUrl); syncContracts();
      toast(n ? 'Réglages et ' + n + ' contrat' + (n > 1 ? 's' : '') + ' importés' : 'Réglages importés');
    } catch (err) { toast('Ce fichier n’est pas une sauvegarde valide'); }
  });

  // ---------- démarrage ----------
  $('#logo').src = window.ASSETS.logo;
  window.Hub.init(S.hubUrl);
  window.Hub.on(() => { if (reconcile() && $('#v-list').classList.contains('on')) renderList(); if (!window.Hub.busy) syncContracts(); });
  noteC();
  cur = blank(); show('list');
  if (window.Hub.ready) window.Hub.sync();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && window.Hub.ready) window.Hub.sync(); });
  if (!S.bailleur.nom) toast('Commencez par les Réglages');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
