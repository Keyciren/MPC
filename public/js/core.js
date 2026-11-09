import { RANKS, SUITS, cardLabel, isRed } from './logic.js';

import { local, checkToken, commitFiles, remoteVersion } from './store.js';
import { CONFIG } from './config.js';
import { emptyDb, publicCopy, uid } from './logic.js';

export const S = {
  db: null,
  token: localStorage.getItem('mpc_gh_token') || null,
  saving: false,
  dirty: false, // hay cambios locales sin publicar
  publishing: false,
  lastPublish: 0,
  noData: false, // aún no hay nada publicado
};

export const isAdmin = () => !!S.token;

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Datos publicados en GitHub Pages (lo que ven los jugadores)
export async function fetchPublished() {
  const r = await fetch('data/db.json?t=' + Date.now(), { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('No se pudieron leer los datos publicados (' + r.status + ')');
  return r.json();
}

export async function loadDb() {
  const pub = await fetchPublished().catch(() => null);
  if (!isAdmin()) {
    S.noData = !pub;
    S.db = pub || emptyDb();
    return S.db;
  }
  // Administrador: la base local manda si es igual o más nueva que la publicada.
  const loc = await local.get('db');
  S.dirty = !!(await local.get('dirty'));
  if (loc && (!pub || (loc.version || 0) >= (pub.version || 0))) {
    S.db = loc;
  } else if (pub) {
    // Se publicó desde otro dispositivo: tomar esa versión y conservar los correos locales
    const emails = Object.fromEntries(((loc && loc.players) || []).filter((p) => p.email).map((p) => [p.id, p.email]));
    S.db = { ...pub, players: pub.players.map((p) => (emails[p.id] ? { ...p, email: emails[p.id] } : p)) };
    S.dirty = false;
    await local.set('db', S.db);
    await local.set('dirty', false);
  } else {
    S.db = emptyDb();
    S.dirty = true;
    await local.set('db', S.db);
    await local.set('dirty', true);
  }
  S.noData = false;
  await loadPendingImages();
  return S.db;
}

export async function login(token) {
  token = token.trim();
  await checkToken(token);
  S.token = token;
  localStorage.setItem('mpc_gh_token', token);
  await loadDb();
}
export function logout() {
  S.token = null;
  localStorage.removeItem('mpc_gh_token');
}

let rerender = () => {};
export function setRerender(fn) {
  rerender = fn;
}
export function refresh() {
  rerender();
}

// Aplica un cambio y lo guarda en la base local. Publicar lo sube a GitHub.
export async function mutate(fn, { silent = true } = {}) {
  const draft = structuredClone(S.db);
  fn(draft);
  S.db = draft;
  S.dirty = true;
  rerender();
  try {
    S.saving = true;
    await local.set('db', draft);
    await local.set('dirty', true);
    if (!silent) toast('Guardado');
  } catch (e) {
    toast('No se pudo guardar en este navegador: ' + e.message, 'error');
    throw e;
  } finally {
    S.saving = false;
  }
}

// Publica la base (sin correos) y las fotos nuevas en el repositorio de GitHub.
export async function publish({ auto = false } = {}) {
  if (!isAdmin() || S.publishing) return;
  S.publishing = true;
  rerender();
  try {
    const remote = await remoteVersion(S.token);
    if (remote > (S.db.version || 0)) {
      const ok = auto ? false : await confirmDlg(`Hay una versión publicada más nueva (v${remote}) hecha desde otro dispositivo. Si publicas, la reemplazarás. ¿Continuar?`, 'Publicar igual');
      if (!ok) return;
    }
    const version = Math.max(remote, S.db.version || 0) + 1;
    const pending = (await local.keys()).filter((k) => String(k).startsWith('img:'));
    const files = [];
    for (const k of pending) {
      const dataUrl = await local.get(k);
      files.push({ path: k.slice(4), base64: dataUrl.split(',')[1] });
    }
    const snapshot = { ...S.db, version };
    files.push({ path: 'data/db.json', content: JSON.stringify(publicCopy(snapshot), null, 1) });
    await commitFiles(S.token, files, `Datos del club v${version}${pending.length ? ` (+${pending.length} foto${pending.length > 1 ? 's' : ''})` : ''}`);
    S.db.version = version;
    await local.set('db', S.db);
    for (const k of pending) await local.del(k);
    S.dirty = false;
    await local.set('dirty', false);
    S.lastPublish = Date.now();
    toast(auto ? 'Publicado automáticamente' : 'Publicado. Los jugadores lo verán en 1–2 minutos.');
  } catch (e) {
    if (e.status === 401) toast('El token de GitHub no es válido o expiró. Vuelve a ingresar.', 'error');
    else toast('No se pudo publicar: ' + e.message, 'error');
  } finally {
    S.publishing = false;
    rerender();
  }
}

export function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, kind === 'error' ? 5000 : 1800);
}

// ---------- Modal ----------
export function modal(html, { onMount, wide } = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><button class="modal-x" aria-label="Cerrar">×</button>${html}</div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('noscroll');
    const close = (val) => {
      wrap.remove();
      if (!document.querySelector('.modal-back')) document.body.classList.remove('noscroll');
      resolve(val);
    };
    wrap.querySelector('.modal-x').onclick = () => close(null);
    wrap.addEventListener('mousedown', (e) => {
      if (e.target === wrap) close(null);
    });
    if (onMount) onMount(wrap.querySelector('.modal'), close);
  });
}

export async function confirmDlg(msg, okLabel = 'Aceptar') {
  return modal(`<p class="mb">${esc(msg)}</p><div class="row end"><button class="btn ghost" data-no>Cancelar</button><button class="btn" data-yes>${esc(okLabel)}</button></div>`, {
    onMount: (m, close) => {
      m.querySelector('[data-no]').onclick = () => close(false);
      m.querySelector('[data-yes]').onclick = () => close(true);
    },
  }).then((v) => !!v);
}

// ---------- Cartas ----------
export function cardHtml(code, small = false) {
  if (!code) return '';
  return `<span class="card ${isRed(code) ? 'red' : ''} ${small ? 'sm' : ''}">${esc(cardLabel(code))}</span>`;
}
export function cardsHtml(cards, small = false) {
  if (!cards || !cards.length) return '<span class="muted">—</span>';
  return `<span class="cards">${cards.map((c) => cardHtml(c, small)).join('')}</span>`;
}

// Selector de cartas: devuelve el arreglo elegido (o null si se cancela)
export function pickCards({ title = 'Elegir cartas', max = 2, selected = [], disabled = [] } = {}) {
  let sel = [...selected];
  const grid = Object.keys(SUITS)
    .map(
      (s) =>
        `<div class="pick-row">${RANKS.map((r) => {
          const c = r + s;
          return `<button type="button" class="pick ${isRed(c) ? 'red' : ''}" data-c="${c}" ${disabled.includes(c) && !selected.includes(c) ? 'disabled' : ''}>${esc(cardLabel(c))}</button>`;
        }).join('')}</div>`
    )
    .join('');
  return modal(
    `<h3>${esc(title)}</h3><p class="muted small">Elige hasta ${max} carta${max > 1 ? 's' : ''}. Las cartas ya usadas en la mano aparecen deshabilitadas.</p>
     <div class="picker">${grid}</div>
     <div class="row between mt"><div data-sel class="cards"></div>
     <div class="row"><button class="btn ghost" data-clear>Limpiar</button><button class="btn" data-ok>Listo</button></div></div>`,
    {
      wide: true,
      onMount: (m, close) => {
        const upd = () => {
          m.querySelectorAll('.pick').forEach((b) => b.classList.toggle('on', sel.includes(b.dataset.c)));
          m.querySelector('[data-sel]').innerHTML = sel.map((c) => cardHtml(c)).join('') || '<span class="muted">Sin cartas</span>';
        };
        m.querySelectorAll('.pick').forEach(
          (b) =>
            (b.onclick = () => {
              const c = b.dataset.c;
              if (sel.includes(c)) sel = sel.filter((x) => x !== c);
              else if (sel.length < max) sel.push(c);
              else if (max === 1) sel = [c];
              upd();
            })
        );
        m.querySelector('[data-clear]').onclick = () => {
          sel = [];
          upd();
        };
        m.querySelector('[data-ok]').onclick = () => close(sel);
        upd();
      },
    }
  );
}

// ---------- Imágenes ----------
// Abre el selector de archivos, reduce la imagen y la sube. Devuelve { url, w, h } o null.
export function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return resolve(null);
      try {
        resolve(await uploadImage(f));
      } catch (e) {
        toast(e.message || 'No se pudo subir la imagen', 'error');
        resolve(null);
      }
    };
    input.click();
  });
}

// Fotos guardadas localmente que aún no se publican: ruta -> URL local
const localImages = {};
async function loadPendingImages() {
  for (const k of await local.keys()) {
    if (String(k).startsWith('img:')) localImages[k.slice(4)] = await local.get(k);
  }
}
export function imgSrc(img) {
  if (!img || !img.url) return '';
  return localImages[img.url] || img.url;
}

export async function uploadImage(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const dataUrl = cv.toDataURL('image/jpeg', 0.82);
  const url = `data/uploads/${new Date().toISOString().slice(0, 10)}-${uid('')}.jpg`;
  await local.set('img:' + url, dataUrl);
  localImages[url] = dataUrl;
  S.dirty = true;
  await local.set('dirty', true);
  return { url, w, h };
}

export function imgHtml(img, cls = '') {
  if (!img || !img.url) return '';
  const src = esc(imgSrc(img));
  return `<a href="${src}" target="_blank" rel="noopener"><img class="photo ${cls}" src="${src}" alt="" loading="lazy"></a>`;
}

// ---------- Helpers ----------
export function on(root, sel, ev, fn) {
  root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, (e) => fn(el, e)));
}

export function fmtDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-CL', opts);
}

export function playerById(id) {
  return S.db.players.find((p) => p.id === id);
}
export function pname(id) {
  const p = playerById(id);
  return p ? p.nickname || p.name : '¿?';
}

export function currentSeason() {
  const db = S.db;
  return db.seasons.find((s) => s.id === db.settings.currentSeasonId) || db.seasons[db.seasons.length - 1] || null;
}

export function playerOptions(ids, selected, empty = '— Ninguno —') {
  return `<option value="">${esc(empty)}</option>` + ids.map((id) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${esc(pname(id))}</option>`).join('');
}

export { CONFIG };
