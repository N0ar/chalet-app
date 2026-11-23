/* Chiffrement des contrats avant leur envoi au hub : AES-GCM 256, clé dérivée de la phrase secrète (PBKDF2-SHA-256).
   La phrase reste sur l'appareil ; le hub ne reçoit que des blocs illisibles. */
(function () {
  const PASS_KEY = 'chalet.pass', SALT = 'le-chalet-sciez/contrats/v1', ITER = 310000;
  const pass = {
    get() { try { return localStorage.getItem(PASS_KEY) || ''; } catch (e) { return pass.mem || ''; } },
    set(v) { pass.mem = v; try { v ? localStorage.setItem(PASS_KEY, v) : localStorage.removeItem(PASS_KEY); } catch (e) { /* stockage indisponible */ } }
  };
  const subtle = window.crypto && window.crypto.subtle;
  const b64 = (buf) => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  let cached = { p: null, k: null };
  function key() {
    const p = pass.get();
    if (cached.p !== p) {
      const enc = new TextEncoder();
      cached = { p, k: subtle.importKey('raw', enc.encode(p), 'PBKDF2', false, ['deriveKey'])
        .then((m) => subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode(SALT), iterations: ITER, hash: 'SHA-256' }, m, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])) };
    }
    return cached.k;
  }
  async function enc(obj) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(JSON.stringify(obj)));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function dec(item) {
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: bytes(item.iv) }, await key(), bytes(item.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }
  window.Coffre = { pass, enc, dec, ready: () => !!subtle && pass.get().length >= 8, available: !!subtle };
})();
