import { RANKS, SUITS, cardLabel, isRed } from './logic.js';

export const S = {
  db: null,
  token: localStorage.getItem('mpc_token') || null,
  saving: false,
};

export const isAdmin = () => !!S.token;

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function api(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && S.token && url !== '/api/login') {
    logout();
    throw new Error('La sesión expiró, vuelve a ingresar.');
  }
  if (!res.ok) {
    const err = new Error(data.error || 'Error ' + res.status);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function loadDb() {
  S.db = await api('GET', '/api/db');
  return S.db;
}

export async function login(password) {
  const { token } = await api('POST', '/api/login', { password });
  S.token = token;
  localStorage.setItem('mpc_token', token);
  await loadDb();
}
export function logout() {
  S.token = null;
  localStorage.removeItem('mpc_token');
}

let rerender = () => {};
export function setRerender(fn) {
  rerender = fn;
}
export function refresh() {
  rerender();
}

// Aplica un cambio a la base de datos y lo guarda en el servidor.
export async function mutate(fn, { silent = false } = {}) {
  const draft = structuredClone(S.db);
  fn(draft);
  const prev = S.db;
  S.db = draft;
  rerender();
  try {
    S.saving = true;
    const { version } = await api('PUT', '/api/db', { version: prev.version, data: draft });
    S.db.version = version;
    if (!silent) toast('Guardado');
  } catch (e) {
    if (e.status === 409 && e.data && e.data.db) {
      S.db = e.data.db;
      toast('Otro dispositivo modificó los datos. Se recargó la información; repite la acción.', 'error');
    } else {
      S.db = prev;
      toast(e.message, 'error');
    }
    rerender();
    throw e;
  } finally {
    S.saving = false;
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

export async function uploadImage(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  let dataUrl;
  let w;
  let h;
  if (bmp) {
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    w = Math.round(bmp.width * scale);
    h = Math.round(bmp.height * scale);
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
    dataUrl = cv.toDataURL('image/jpeg', 0.85);
  } else {
    dataUrl = await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.readAsDataURL(file);
    });
  }
  toast('Subiendo imagen…');
  const { url } = await api('POST', '/api/upload', { dataUrl });
  return { url, w, h };
}

export function imgHtml(img, cls = '') {
  if (!img || !img.url) return '';
  return `<a href="${esc(img.url)}" target="_blank" rel="noopener"><img class="photo ${cls}" src="${esc(img.url)}" alt="" loading="lazy"></a>`;
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
