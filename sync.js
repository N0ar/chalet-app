/* Données partagées via le hub : tarifs, suivi des séjours (par dates, sans nom) et contrats chiffrés sur l'appareil.
   Une copie reste sur l'appareil : l'app fonctionne hors ligne et envoie les modifications dès que possible. */
(function () {
  const KEY = 'chalet.shared';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  let st = read() || { version: 0, data: {}, dirty: false, at: 0 };
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* stockage indisponible */ } };
  let hub = '', timer = null, busy = false, error = '', rev = 0;
  const subs = [];
  const emit = () => subs.forEach((f) => { try { f(); } catch (e) { /* un écran ne doit pas bloquer les autres */ } });

  const base = (u) => String(u || '').trim().replace(/\/(feed|data)\/.*$/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const url = () => { const b = base(hub), t = window.Agenda.token.get(); return b && t ? b + '/data/app.json?key=' + encodeURIComponent(t) : ''; };
  const shape = (d) => { d = d && typeof d === 'object' && !Array.isArray(d) ? d : {}; if (!d.suivi || typeof d.suivi !== 'object') d.suivi = {};
    if (!d.contrats || typeof d.contrats !== 'object') d.contrats = {}; if (!d.contrats.items || typeof d.contrats.items !== 'object') d.contrats.items = {}; return d; };
  // Fusion : pour les tarifs comme pour chaque séjour suivi, la modification la plus récente l'emporte.
  const newer = (a, b) => (!a ? b : !b ? a : String(a.maj || '') >= String(b.maj || '') ? a : b);
  function merge(loc, rem) {
    loc = shape(loc); rem = shape(rem);
    const o = Object.assign({}, rem, loc), t = newer(loc.tarifs, rem.tarifs);
    if (t) o.tarifs = t;
    const each = (a, b) => { const m = {}; Object.keys(Object.assign({}, b, a)).forEach((k) => { m[k] = newer(a[k], b[k]); }); return m; };
    o.suivi = each(loc.suivi, rem.suivi);
    o.contrats = { items: each(loc.contrats.items, rem.contrats.items) }; // contrats chiffrés, un bloc par contrat
    return o;
  }
  const fail = (s) => new Error(s === 403 ? 'Le jeton a été refusé. Le partage demande le jeton de l’application (Réglages).'
    : s === 503 ? 'Le stockage partagé n’est pas encore disponible sur le hub.'
    : s === 413 ? 'Les données partagées sont trop volumineuses.' : 'Le hub a répondu avec une erreur (' + s + ').');

  async function put(u, tries) {
    const r0 = rev;
    const r = await fetch(u, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base_version: st.version, data: st.data }) });
    if (r.status === 409 && tries > 1) { const j = await r.json(); st.data = merge(st.data, j.data); st.version = j.version; write(); return put(u, tries - 1); }
    if (!r.ok) throw fail(r.status);
    const j = await r.json(); st.version = j.version; st.dirty = rev !== r0;
  }
  async function sync() {
    const u = url();
    if (!u) { error = 'config'; emit(); return; }
    if (busy) return;
    busy = true; error = ''; emit();
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) throw fail(r.status);
      const j = await r.json();
      st.data = st.dirty ? merge(st.data, j.data) : shape(j.data); st.version = j.version || 0;
      if (st.dirty) await put(u, 3);
      st.at = Date.now(); write();
    } catch (e) { error = e instanceof TypeError ? 'offline' : e.message; }
    busy = false; emit();
    if (st.dirty && !error) plan();
  }
  function plan() { clearTimeout(timer); timer = setTimeout(sync, 1200); }
  function change(fn) { st.data = shape(st.data); fn(st.data); st.dirty = true; rev++; write(); emit(); plan(); }
  function status() {
    if (busy) return 'Synchronisation…';
    if (error === 'config') return 'Enregistré sur cet appareil seulement (hub non réglé)';
    if (error === 'offline') return 'Hors ligne : ' + (st.dirty ? 'modifications en attente d’envoi' : 'dernières données connues');
    if (error) return error;
    if (st.dirty) return 'Modifications en attente d’envoi';
    return st.at ? 'Partagé via le hub' : 'Pas encore synchronisé';
  }
  window.Hub = { init(h) { hub = h; }, data: () => (st.data = shape(st.data)), sync, change, status, on(f) { subs.push(f); },
    get busy() { return busy; }, get ready() { return !!url(); } };
})();
