// Sealed content: PBKDF2-SHA256 -> AES-GCM. Matches authoring/build.py.
const GT = (() => {
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const norm = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

  async function key(secret, saltB64, iter) {
    const base = await crypto.subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(saltB64), iterations: iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }
  async function open(k, blob) {
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(blob.iv) }, k, b64(blob.ct));
      return JSON.parse(td.decode(pt));
    } catch { return null; }
  }
  // Returns every sealed bundle the code opens (usually one).
  async function unlock(code, sealed) {
    const k = await key(norm(code), sealed.salt, sealed.iter);
    const hits = [];
    for (const blob of sealed.blobs) { const v = await open(k, blob); if (v) hits.push(v); }
    return hits;
  }
  async function answer(answers, sealed) {
    return open(await key(answers, sealed.salt, sealed.iter), sealed);
  }
  return { norm, unlock, answer };
})();
