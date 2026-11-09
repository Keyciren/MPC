// Base de datos local (IndexedDB del navegador del administrador) y publicación en GitHub.
import { CONFIG } from './config.js';

// ---------- IndexedDB ----------
let dbp;
function idb() {
  dbp =
    dbp ||
    new Promise((res, rej) => {
      const r = indexedDB.open('mpc-club', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  return dbp;
}
function tx(mode, fn) {
  return idb().then(
    (d) =>
      new Promise((res, rej) => {
        const t = d.transaction('kv', mode);
        const req = fn(t.objectStore('kv'));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
      })
  );
}
export const local = {
  get: (k) => tx('readonly', (s) => s.get(k)),
  set: (k, v) => tx('readwrite', (s) => s.put(v, k)),
  del: (k) => tx('readwrite', (s) => s.delete(k)),
  keys: () => tx('readonly', (s) => s.getAllKeys()),
};

// ---------- GitHub ----------
const API = 'https://api.github.com';
async function gh(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.message || 'GitHub respondió ' + res.status);
    e.status = res.status;
    throw e;
  }
  return data;
}
const repoPath = () => `/repos/${CONFIG.owner}/${CONFIG.repo}`;

export async function checkToken(token) {
  const r = await gh(token, 'GET', repoPath());
  if (!r.permissions || !r.permissions.push) throw new Error('El token no tiene permiso de escritura en ' + r.full_name);
  return r;
}

// Lee la versión publicada directamente del repositorio (sin esperar a GitHub Pages)
export async function remoteVersion(token) {
  try {
    const r = await gh(token, 'GET', `${repoPath()}/contents/${CONFIG.siteDir}/data/db.json?ref=${CONFIG.branch}`);
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(r.content.replace(/\n/g, '')), (c) => c.charCodeAt(0))));
    return json.version || 0;
  } catch (e) {
    if (e.status === 404) return 0;
    throw e;
  }
}

// Sube db.json y las fotos nuevas en un solo commit.
// files: [{ path (relativo al sitio), content (texto) | base64 }]
export async function commitFiles(token, files, message) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await gh(token, 'GET', `${repoPath()}/git/ref/heads/${CONFIG.branch}`);
    const head = await gh(token, 'GET', `${repoPath()}/git/commits/${ref.object.sha}`);
    const tree = [];
    for (const f of files) {
      const blob = await gh(token, 'POST', `${repoPath()}/git/blobs`, f.base64 != null ? { content: f.base64, encoding: 'base64' } : { content: f.content, encoding: 'utf-8' });
      tree.push({ path: `${CONFIG.siteDir}/${f.path}`, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const newTree = await gh(token, 'POST', `${repoPath()}/git/trees`, { base_tree: head.tree.sha, tree });
    const commit = await gh(token, 'POST', `${repoPath()}/git/commits`, { message, tree: newTree.sha, parents: [head.sha] });
    try {
      await gh(token, 'PATCH', `${repoPath()}/git/refs/heads/${CONFIG.branch}`, { sha: commit.sha });
      return commit;
    } catch (e) {
      if (e.status !== 422 || attempt === 2) throw e; // alguien publicó justo antes: reintentar
    }
  }
}
