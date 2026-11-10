import { S, loadDb, isAdmin, logout, setRerender, esc, toast, publish, fetchPublished, CONFIG, checkRemote, adoptRemote, confirmDlg, login } from './core.js';
import { historyView, homeView, calendarView, tournamentView, rankingView, pointsView, statsView, bindTabs, clockState, fmtMs } from './views-public.js';
import { loginView, playersView, seasonAdminView, pointsAdminView, tournamentAdminView, settingsView, cobrosView } from './views-admin.js';

const main = document.getElementById('main');
const nav = document.getElementById('nav');
let current = null;

function parseHash() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  return { parts: path.split('/').filter(Boolean), q, path };
}

function route() {
  const { parts, q } = parseHash();
  const [a, b, c] = parts;
  if (!a) return homeView();
  if (a === 'calendario') return calendarView(q);
  if (a === 'torneo' && b) return tournamentView(b);
  if (a === 'ranking') return rankingView(q);
  if (a === 'puntajes') return pointsView();
  if (a === 'estadisticas') return statsView(q);
  if (a === 'historial') return historyView();
  if (a === 'login') return loginView();
  if (a === 'admin') {
    if (!isAdmin()) return loginView();
    if (b === 'jugadores') return playersView();
    if (b === 'temporada') return seasonAdminView(q);
    if (b === 'puntajes') return pointsAdminView();
    if (b === 'fecha' && c) return tournamentAdminView(c);
    if (b === 'ajustes') return settingsView();
    if (b === 'cobros') return cobrosView();
    return seasonAdminView(q);
  }
  return { html: '<p>Página no encontrada.</p>' };
}

function renderNav() {
  const { path } = parseHash();
  const link = (href, label) => `<a href="${href}" class="${path === href.slice(1) || (href !== '#/' && path.startsWith(href.slice(1))) ? 'on' : ''}">${label}</a>`;
  // Botón "En vivo" mientras haya una fecha en juego (si hay más de una, la más reciente)
  const live = [...S.db.tournaments].filter((t) => t.status === 'running').sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0];
  const liveHref = live ? (isAdmin() ? `#/admin/fecha/${live.id}` : `#/torneo/${live.id}`) : '';
  const onLive = live && (path === liveHref.slice(1));
  nav.innerHTML = `
    <a class="brand" href="#/">♠ ${esc(S.db.settings.clubName)}</a>
    ${live ? `<a class="live-btn ${onLive ? 'on' : ''}" href="${liveHref}" title="${esc(live.label)} en juego"><span class="dot-live"></span>En vivo</a>` : ''}
    <button class="burger" aria-label="Menú" onclick="document.body.classList.toggle('menu-open')">☰</button>
    <div class="links">
      ${link('#/calendario', 'Calendario')}
      ${link('#/ranking', 'Posiciones')}
      ${link('#/puntajes', 'Puntajes')}
      ${link('#/estadisticas', 'Estadísticas')}
      ${link('#/historial', 'Historial')}
      ${
        isAdmin()
          ? `<span class="sep"></span>${S.remoteNewer ? `<button class="btn sm danger" data-remotenewer title="Se publicó una versión más nueva desde otro lugar">⚠ Hay una versión nueva</button>` : ''}<button class="btn sm ${S.dirty ? '' : 'ghost'} pub-btn" data-publish ${S.publishing ? 'disabled' : ''} title="${S.dirty ? 'Hay cambios guardados solo en este navegador' : 'Todo publicado'}">${S.publishing ? 'Publicando…' : S.dirty ? '⬆ Publicar cambios' : '✓ Publicado'}</button>${link('#/admin/temporada', 'Temporada')}${link('#/admin/jugadores', 'Jugadores')}${link('#/admin/cobros', 'Cobros')}${link('#/admin/puntajes', 'Editar puntajes')}${link('#/admin/ajustes', 'Ajustes')}<a href="#" data-logout>Salir</a>`
          : `<a href="#/login" class="admin-link">Admin</a>`
      }
    </div>`;
  const rn = nav.querySelector('[data-remotenewer]');
  if (rn)
    rn.onclick = async () => {
      if (await confirmDlg(`Hay una versión publicada más nueva (v${S.remoteNewer}). ¿Cargarla? Los cambios sin publicar de este navegador se descartan.`, 'Cargar')) adoptRemote();
    };
  const pb = nav.querySelector('[data-publish]');
  if (pb) pb.onclick = () => publish();
  const lo = nav.querySelector('[data-logout]');
  if (lo)
    lo.onclick = async (e) => {
      e.preventDefault();
      logout();
      await loadDb();
      location.hash = '#/';
      render();
    };
}

function render() {
  if (!S.db) return;
  const y = window.scrollY;
  renderNav();
  try {
    current = route();
  } catch (e) {
    console.error(e);
    current = { html: `<div class="panel warn"><p>Ocurrió un error mostrando esta página.</p><pre class="small">${esc(e.stack || e.message)}</pre></div>` };
  }
  main.innerHTML = current.html;
  bindTabs(main);
  if (current.bind) current.bind(main);
  window.scrollTo(0, y);
}

setRerender(render);

let lastPath = parseHash().path;
window.addEventListener('hashchange', () => {
  document.body.classList.remove('menu-open');
  const { path } = parseHash();
  const y = window.scrollY;
  render();
  // Al elegir otra fecha dentro de la misma página (p. ej. resumen bajo la tabla de posiciones) no saltar arriba
  window.scrollTo(0, path === lastPath ? y : 0);
  lastPath = path;
});

// Reloj en pantalla (vista jugador y admin)
setInterval(() => {
  if (!current || !S.db) return;
  if (current.tick) return current.tick(main);
  const el = main.querySelector('[data-time]');
  const { parts } = parseHash();
  if (el && parts[0] === 'torneo') {
    const t = S.db.tournaments.find((x) => x.id === parts[1]);
    if (t && t.config) el.textContent = fmtMs(clockState(t).remaining);
  }
}, 500);

// Jugadores: revisan cada 30 s si el administrador publicó algo nuevo
setInterval(async () => {
  if (isAdmin() || !S.db || document.hidden) return;
  if (document.querySelector('.modal-back')) return;
  try {
    const pub = await fetchPublished();
    if (pub && pub.version !== S.db.version) {
      S.db = pub;
      S.noData = false;
      render();
    }
  } catch {}
}, 30000);

// Administrador: revisa cada minuto si se publicó algo más nuevo desde otro lugar
setInterval(() => {
  if (document.hidden || document.querySelector('.modal-back')) return;
  checkRemote().then(() => {});
}, 60000);

// Administrador: con un torneo en juego, publica solo cada pocos minutos
setInterval(() => {
  if (!isAdmin() || !S.db || !S.dirty || S.publishing || !CONFIG.autoPublishMinutes) return;
  if (!S.db.tournaments.some((t) => t.status === 'running')) return;
  if (Date.now() - S.lastPublish < CONFIG.autoPublishMinutes * 60000) return;
  if (!S.lastPublish) S.lastPublish = Date.now(); // primera vez: espera un intervalo
  else publish({ auto: true });
}, 20000);

// Si se publicó una versión nueva de la web, las pantallas abiertas se recargan solas (los datos locales no se pierden)
setInterval(async () => {
  if (!window.APP_VERSION || document.querySelector('.modal-back') || S.publishing || S.saving) return;
  const ae = document.activeElement;
  if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return;
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    const { version } = await r.json();
    if (version && version !== window.APP_VERSION) {
      reloading = true;
      location.reload();
    }
  } catch {}
}, 60000);
let reloading = false;

window.addEventListener('beforeunload', (e) => {
  if (reloading) return;
  if (isAdmin() && S.dirty) e.preventDefault();
});

// Vincular dispositivo: el QR abre #/vincular?k=<token>. Se valida, se guarda y se borra de la dirección.
async function linkFromQr() {
  const m = /^#\/vincular\?k=([^&]+)/.exec(location.hash);
  if (!m) return;
  history.replaceState(null, '', location.pathname + '#/');
  try {
    await login(decodeURIComponent(m[1]));
    toast('📱 Dispositivo vinculado como administrador');
    location.hash = '#/admin/temporada';
  } catch (e) {
    toast('No se pudo vincular: ' + e.message, 'error');
  }
}

linkFromQr()
  .then(() => (S.db ? null : loadDb()))
  .then(render)
  .catch((e) => {
    main.innerHTML = `<div class="panel warn">No se pudo conectar con el servidor: ${esc(e.message)}</div>`;
    toast(e.message, 'error');
  });
